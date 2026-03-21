import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import {
  createServer,
  type IncomingHttpHeaders,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import {
  createExportJobRecord,
  createParticipantRecord,
  getComplianceRecord,
  getExportJobRecord,
  getLastSyncAtRecord,
  getParticipantRecord,
  getStoredProtocolRecord,
  getSyncStatusRecordIds,
  isDatabaseEnabled,
  listParticipantRecords,
  saveStoredProtocolRecord,
  type ContextSnapshot,
  type ExportJob,
  type ParticipantRecord,
  type PromptLogEntry,
  type SessionUpload,
  type StoredProtocol,
  type StudyProtocol,
  type SurveyResponse,
  upsertContextSnapshotRecords,
  upsertPromptLogRecords,
  upsertSessionUploadRecord,
  upsertSurveyResponseRecords,
  updateExportJobRecord,
} from "./data-store.js";
import { loadPersistedState, savePersistedState } from "./persistence.js";

type RouteContext = {
  request: IncomingMessage;
  response: ServerResponse;
  params: Record<string, string>;
  query: URLSearchParams;
  body: unknown;
};

type RouteHandler = (ctx: RouteContext) => Promise<void> | void;

type ParticipantSummary = {
  participant_id: string;
  study_id: string;
  enrolled_at: string;
  last_sync_at: string | null;
  protocol_version: number | null;
};

const participants = new Map<string, ParticipantRecord>();
const studyProtocols = new Map<string, StoredProtocol>();
const promptLogs = new Map<string, PromptLogEntry>();
const contextSnapshots = new Map<string, ContextSnapshot>();
const surveyResponses = new Map<string, SurveyResponse>();
const sessions = new Map<string, SessionUpload>();
const exportJobs = new Map<string, ExportJob>();
const DATABASE_ENABLED = isDatabaseEnabled();

const JWT_SECRET = process.env.JWT_SECRET ?? "ema-server-dev-secret";
const API_KEY = process.env.EMA_API_KEY ?? "ema-dev-api-key";
const PORT = Number(process.env.PORT ?? 3000);
const API_PREFIX = "/v1";

function snapshotState() {
  return {
    participants: DATABASE_ENABLED ? [] : [...participants.values()],
    studyProtocols: DATABASE_ENABLED ? [] : [...studyProtocols.values()],
    promptLogs: [...promptLogs.values()],
    contextSnapshots: [...contextSnapshots.values()],
    surveyResponses: [...surveyResponses.values()],
    sessions: [...sessions.values()],
    exportJobs: DATABASE_ENABLED ? [] : [...exportJobs.values()],
  };
}

async function persistState(): Promise<void> {
  await savePersistedState(snapshotState());
}

async function hydrateState(): Promise<void> {
  const state = await loadPersistedState();
  participants.clear();
  studyProtocols.clear();
  promptLogs.clear();
  contextSnapshots.clear();
  surveyResponses.clear();
  sessions.clear();
  exportJobs.clear();

  if (!DATABASE_ENABLED) {
    for (const row of state.participants) {
      const participant = row as ParticipantRecord;
      if (typeof participant.participant_id === "string") {
        participants.set(participant.participant_id, participant);
      }
    }
    for (const row of state.studyProtocols) {
      const protocol = row as StoredProtocol;
      if (typeof protocol.study_id === "string") {
        studyProtocols.set(protocol.study_id, protocol);
      }
    }
  }
  for (const row of state.promptLogs) {
    const entry = row as PromptLogEntry;
    if (typeof entry.prompt_id === "string") {
      promptLogs.set(entry.prompt_id, entry);
    }
  }
  for (const row of state.contextSnapshots) {
    const snapshot = row as ContextSnapshot;
    if (typeof snapshot.snapshot_id === "string") {
      contextSnapshots.set(snapshot.snapshot_id, snapshot);
    }
  }
  for (const row of state.surveyResponses) {
    const response = row as SurveyResponse;
    if (typeof response.record_id === "string") {
      surveyResponses.set(response.record_id, response);
    }
  }
  for (const row of state.sessions) {
    const session = row as SessionUpload;
    if (typeof session.session_uuid === "string") {
      sessions.set(session.session_uuid, session);
    }
  }
  if (!DATABASE_ENABLED) {
    for (const row of state.exportJobs) {
      const job = row as ExportJob;
      if (typeof job.job_id === "string") {
        exportJobs.set(job.job_id, job);
      }
    }
  }
}

function base64UrlEncode(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(input: string): Buffer {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "=",
  );
  return Buffer.from(padded, "base64");
}

function signJwt(payload: Record<string, unknown>): string {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const unsigned = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac("sha256", JWT_SECRET).update(unsigned).digest();
  return `${unsigned}.${base64UrlEncode(signature)}`;
}

function verifyJwt(token: string): Record<string, unknown> | null {
  const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");
  if (!encodedHeader || !encodedPayload || !encodedSignature) return null;

  const unsigned = `${encodedHeader}.${encodedPayload}`;
  const expected = createHmac("sha256", JWT_SECRET).update(unsigned).digest();
  const received = base64UrlDecode(encodedSignature);
  if (expected.length !== received.length) return null;
  if (!timingSafeEqual(expected, received)) return null;

  try {
    return JSON.parse(
      base64UrlDecode(encodedPayload).toString("utf8"),
    ) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function writeJson(
  response: ServerResponse,
  statusCode: number,
  payload: unknown,
) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  response.end(body);
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) return null;
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return null;
  return JSON.parse(raw) as unknown;
}

function matchPath(
  pattern: string,
  pathname: string,
): Record<string, string> | null {
  const patternParts = pattern.split("/").filter(Boolean);
  const pathParts = pathname.split("/").filter(Boolean);
  if (patternParts.length !== pathParts.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i];
    const pathPart = pathParts[i];
    if (patternPart.startsWith(":")) {
      params[patternPart.slice(1)] = decodeURIComponent(pathPart);
      continue;
    }
    if (patternPart !== pathPart) return null;
  }

  return params;
}

function hasApiKey(headers: IncomingHttpHeaders): boolean {
  return headers["x-api-key"] === API_KEY;
}

function requireBearer(
  headers: IncomingHttpHeaders,
): Record<string, unknown> | null {
  const header = headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  return verifyJwt(header.slice("Bearer ".length));
}

async function getStudyProtocol(
  studyId: string,
): Promise<StoredProtocol | null> {
  if (DATABASE_ENABLED) {
    return getStoredProtocolRecord(studyId);
  }
  return studyProtocols.get(studyId) ?? null;
}

async function getParticipant(
  participantId: string,
): Promise<ParticipantRecord | null> {
  if (DATABASE_ENABLED) {
    return getParticipantRecord(participantId);
  }
  return participants.get(participantId) ?? null;
}

function canReadParticipant(
  headers: IncomingHttpHeaders,
  participantId: string,
): boolean {
  if (hasApiKey(headers)) return true;
  const auth = requireBearer(headers);
  return Boolean(auth && auth.participant_id === participantId);
}

async function requireParticipantAuth(
  headers: IncomingHttpHeaders,
  participantId: string,
): Promise<{ ok: true } | { ok: false; statusCode: number; error: string }> {
  const participant = await getParticipant(participantId);
  if (!participant) {
    return { ok: false, statusCode: 404, error: "Participant not found" };
  }

  if (hasApiKey(headers)) {
    return { ok: true };
  }

  const auth = requireBearer(headers);
  if (!auth || auth.participant_id !== participantId) {
    return { ok: false, statusCode: 403, error: "Forbidden" };
  }

  return { ok: true };
}

async function getLastSyncAt(participantId: string): Promise<string | null> {
  if (DATABASE_ENABLED) {
    return getLastSyncAtRecord(participantId);
  }
  const timestamps = [...sessions.values()]
    .filter((session) => session.participant_id === participantId)
    .map((session) => session.ended_at ?? session.started_at)
    .filter((value): value is string => typeof value === "string");

  if (timestamps.length === 0) return null;
  return timestamps.sort().at(-1) ?? null;
}

async function toParticipantSummary(
  entry: ParticipantRecord,
  protocolVersion: number | null,
): Promise<ParticipantSummary> {
  return {
    participant_id: entry.participant_id,
    study_id: entry.study_id,
    enrolled_at: entry.enrolled_at,
    last_sync_at: await getLastSyncAt(entry.participant_id),
    protocol_version: protocolVersion,
  };
}

async function upsertPromptLogs(entries: PromptLogEntry[]): Promise<number> {
  if (DATABASE_ENABLED) {
    return upsertPromptLogRecords(entries);
  }
  let upserted = 0;
  for (const entry of entries) {
    if (!promptLogs.has(entry.prompt_id)) upserted += 1;
    promptLogs.set(entry.prompt_id, entry);
  }
  await persistState();
  return upserted;
}

async function upsertContextSnapshots(
  rows: ContextSnapshot[],
): Promise<number> {
  if (DATABASE_ENABLED) {
    return upsertContextSnapshotRecords(rows);
  }
  let stored = 0;
  for (const row of rows) {
    if (!contextSnapshots.has(row.snapshot_id)) stored += 1;
    contextSnapshots.set(row.snapshot_id, row);
  }
  await persistState();
  return stored;
}

async function upsertSurveyResponses(rows: SurveyResponse[]): Promise<number> {
  if (DATABASE_ENABLED) {
    return upsertSurveyResponseRecords(rows);
  }
  let stored = 0;
  for (const row of rows) {
    if (!surveyResponses.has(row.record_id)) stored += 1;
    surveyResponses.set(row.record_id, row);
  }
  await persistState();
  return stored;
}

async function seedDemoProtocol() {
  if (await getStudyProtocol("dev-study")) {
    return;
  }

  const studyId = "dev-study";
  const protocol: StudyProtocol = {
    study_id: studyId,
    study_uuid: randomUUID(),
    version: 1,
    schedule: {
      schedule_mode: "random_block",
      time_blocks: [{ start: "09:00", end: "21:00" }],
      prompts_per_day: 5,
      randomize_within_window: true,
      expiry_minutes: 30,
      days_total: 14,
      min_gap_minutes: 30,
    },
    assessments: [],
    ema_survey: {
      survey_id: "ema-mood-stress",
      survey_version: 1,
      title: "EMA Check-in",
      items: [],
    },
    context_collection: {
      gps_on_prompt: false,
      gps_interval_minutes: null,
      collect_battery: false,
      collect_network_type: true,
    },
  };

  if (DATABASE_ENABLED) {
    await saveStoredProtocolRecord({
      study_id: studyId,
      version: 1,
      protocol,
    });
    return;
  }

  studyProtocols.set(studyId, {
    study_id: studyId,
    version: 1,
    protocol,
    updated_at: new Date().toISOString(),
  });
  await persistState();
}

const routes: Array<{
  method: string;
  pattern: string;
  handler: RouteHandler;
}> = [
  {
    method: "GET",
    pattern: "/health",
    handler: ({ response }) => {
      writeJson(response, 200, {
        ok: true,
        service: "ema-server",
        timestamp: new Date().toISOString(),
      });
    },
  },
  {
    method: "POST",
    pattern: "/participants",
    handler: async ({ response, body }) => {
      const payload = body as {
        study_id?: unknown;
        device_id?: unknown;
      } | null;
      const studyId =
        typeof payload?.study_id === "string" ? payload.study_id : "";
      const deviceId =
        typeof payload?.device_id === "string" ? payload.device_id : undefined;

      if (!studyId) {
        writeJson(response, 400, {
          error: "study_id is required",
        });
        return;
      }

      const storedProtocol = await getStudyProtocol(studyId);
      if (!storedProtocol) {
        writeJson(response, 404, { error: "Study protocol not found" });
        return;
      }

      const participantId = `P-${randomUUID().slice(0, 8)}`;
      const token = signJwt({
        participant_id: participantId,
        study_id: studyId,
      });
      if (DATABASE_ENABLED) {
        await createParticipantRecord({
          participant_id: participantId,
          study_id: studyId,
          token,
          device_id: deviceId,
        });
      } else {
        participants.set(participantId, {
          participant_id: participantId,
          study_id: studyId,
          token,
          enrolled_at: new Date().toISOString(),
          device_id: deviceId,
        });
        await persistState();
      }
      writeJson(response, 201, { participant_id: participantId, token });
    },
  },
  {
    method: "GET",
    pattern: "/participants",
    handler: async ({ request, response, query }) => {
      if (!hasApiKey(request.headers)) {
        writeJson(response, 401, { error: "API key required" });
        return;
      }

      const studyId = query.get("study_id");
      const rows = DATABASE_ENABLED
        ? await listParticipantRecords(studyId ?? undefined)
        : [...participants.values()].filter((entry) =>
            studyId ? entry.study_id === studyId : true,
          );
      const summaries = await Promise.all(
        rows.map(async (entry) =>
          toParticipantSummary(
            entry,
            (await getStudyProtocol(entry.study_id))?.version ?? null,
          ),
        ),
      );
      writeJson(response, 200, summaries);
    },
  },
  {
    method: "GET",
    pattern: "/participants/:participant_id/protocol",
    handler: async ({ request, response, params, query }) => {
      const authResult = await requireParticipantAuth(
        request.headers,
        params.participant_id,
      );
      if (!authResult.ok) {
        writeJson(response, authResult.statusCode, { error: authResult.error });
        return;
      }

      const participant = await getParticipant(params.participant_id);
      if (!participant) {
        writeJson(response, 404, { error: "Participant not found" });
        return;
      }
      const stored = await getStudyProtocol(participant.study_id);
      if (!stored) {
        writeJson(response, 404, { error: "Protocol not found" });
        return;
      }

      const currentVersion = Number(query.get("current_version"));
      if (!Number.isNaN(currentVersion) && currentVersion === stored.version) {
        response.writeHead(304);
        response.end();
        return;
      }

      writeJson(response, 200, stored.protocol);
    },
  },
  {
    method: "GET",
    pattern: "/studies/:study_id/protocol",
    handler: async ({ request, response, params, query }) => {
      if (!hasApiKey(request.headers)) {
        writeJson(response, 401, { error: "API key required" });
        return;
      }

      const stored = await getStudyProtocol(params.study_id);
      if (!stored) {
        writeJson(response, 404, { error: "Protocol not found" });
        return;
      }

      const currentVersion = Number(query.get("current_version"));
      if (!Number.isNaN(currentVersion) && currentVersion === stored.version) {
        response.writeHead(304);
        response.end();
        return;
      }

      writeJson(response, 200, stored.protocol);
    },
  },
  {
    method: "PUT",
    pattern: "/studies/:study_id/protocol",
    handler: async ({ request, response, params, body }) => {
      if (!hasApiKey(request.headers)) {
        writeJson(response, 401, { error: "API key required" });
        return;
      }

      const payload = body as { version?: unknown } | null;
      const version =
        typeof payload?.version === "number" ? payload.version : null;
      if (!version || !body || typeof body !== "object") {
        writeJson(response, 400, { error: "Invalid protocol payload" });
        return;
      }

      const existing = await getStudyProtocol(params.study_id);
      if (existing && version <= existing.version) {
        writeJson(response, 409, { error: "Protocol version must increase" });
        return;
      }

      if (DATABASE_ENABLED) {
        await saveStoredProtocolRecord({
          study_id: params.study_id,
          version,
          protocol: body as StudyProtocol,
        });
      } else {
        studyProtocols.set(params.study_id, {
          study_id: params.study_id,
          version,
          protocol: body as StudyProtocol,
          updated_at: new Date().toISOString(),
        });
        await persistState();
      }
      writeJson(response, 200, { version });
    },
  },
  {
    method: "POST",
    pattern: "/sessions",
    handler: async ({ request, response, body }) => {
      const payload = body as SessionUpload | null;
      if (
        !payload?.session_uuid ||
        !payload.participant_id ||
        !payload.study_id
      ) {
        writeJson(response, 400, { error: "Invalid session payload" });
        return;
      }

      const authResult = await requireParticipantAuth(
        request.headers,
        payload.participant_id,
      );
      if (!authResult.ok) {
        writeJson(response, authResult.statusCode, { error: authResult.error });
        return;
      }

      const duplicate = DATABASE_ENABLED
        ? (await upsertSessionUploadRecord(payload)).duplicate
        : sessions.has(payload.session_uuid);
      if (!DATABASE_ENABLED) {
        sessions.set(payload.session_uuid, payload);
        await persistState();
      }
      writeJson(response, duplicate ? 200 : 201, {
        session_uuid: payload.session_uuid,
        duplicate,
      });
    },
  },
  {
    method: "POST",
    pattern: "/prompt-logs",
    handler: async ({ request, response, body }) => {
      const entries = Array.isArray((body as { entries?: unknown })?.entries)
        ? (body as { entries: PromptLogEntry[] }).entries
        : [];
      const participantId = entries[0]?.participant_id;
      if (typeof participantId !== "string") {
        writeJson(response, 400, {
          error: "participant_id is required on prompt logs",
        });
        return;
      }
      const authResult = await requireParticipantAuth(
        request.headers,
        participantId,
      );
      if (!authResult.ok) {
        writeJson(response, authResult.statusCode, { error: authResult.error });
        return;
      }
      writeJson(response, 200, { upserted: await upsertPromptLogs(entries) });
    },
  },
  {
    method: "POST",
    pattern: "/context-snapshots",
    handler: async ({ request, response, body }) => {
      const snapshots = Array.isArray(
        (body as { snapshots?: unknown })?.snapshots,
      )
        ? (body as { snapshots: ContextSnapshot[] }).snapshots
        : [];
      const participantId = snapshots[0]?.participant_id;
      if (typeof participantId !== "string") {
        writeJson(response, 400, {
          error: "participant_id is required on context snapshots",
        });
        return;
      }
      const authResult = await requireParticipantAuth(
        request.headers,
        participantId,
      );
      if (!authResult.ok) {
        writeJson(response, authResult.statusCode, { error: authResult.error });
        return;
      }
      writeJson(response, 200, {
        stored: await upsertContextSnapshots(snapshots),
      });
    },
  },
  {
    method: "POST",
    pattern: "/survey-responses",
    handler: async ({ request, response, body }) => {
      const rows = Array.isArray((body as { responses?: unknown })?.responses)
        ? (body as { responses: SurveyResponse[] }).responses
        : [];
      const participantId = rows[0]?.participant_id;
      if (typeof participantId !== "string") {
        writeJson(response, 400, {
          error: "participant_id is required on survey responses",
        });
        return;
      }
      const authResult = await requireParticipantAuth(
        request.headers,
        participantId,
      );
      if (!authResult.ok) {
        writeJson(response, authResult.statusCode, { error: authResult.error });
        return;
      }
      writeJson(response, 200, { stored: await upsertSurveyResponses(rows) });
    },
  },
  {
    method: "GET",
    pattern: "/participants/:participant_id/sync-status",
    handler: async ({ request, response, params, query }) => {
      const authResult = await requireParticipantAuth(
        request.headers,
        params.participant_id,
      );
      if (!authResult.ok) {
        writeJson(response, authResult.statusCode, { error: authResult.error });
        return;
      }

      const since = query.get("since");
      if (DATABASE_ENABLED) {
        writeJson(
          response,
          200,
          await getSyncStatusRecordIds({
            participant_id: params.participant_id,
            since,
          }),
        );
        return;
      }

      const sinceMs = since ? new Date(since).getTime() : null;
      const isAfterSince = (value: string | undefined) =>
        sinceMs === null ||
        !Number.isFinite(sinceMs) ||
        (value ? new Date(value).getTime() >= sinceMs : false);

      writeJson(response, 200, {
        session_uuids: [...sessions.values()]
          .filter(
            (session) =>
              session.participant_id === params.participant_id &&
              isAfterSince(session.ended_at ?? session.started_at),
          )
          .map((session) => session.session_uuid),
        prompt_ids: [...promptLogs.values()]
          .filter(
            (row) =>
              row.participant_id === params.participant_id &&
              isAfterSince(
                typeof row.assessment_ended_at === "string"
                  ? row.assessment_ended_at
                  : typeof row.opened_at === "string"
                    ? row.opened_at
                    : typeof row.sent_at === "string"
                      ? row.sent_at
                      : undefined,
              ),
          )
          .map((row) => row.prompt_id),
        snapshot_ids: [...contextSnapshots.values()]
          .filter(
            (row) =>
              row.participant_id === params.participant_id &&
              isAfterSince(
                typeof row.captured_at === "string"
                  ? row.captured_at
                  : undefined,
              ),
          )
          .map((row) => row.snapshot_id),
        survey_response_ids: [...surveyResponses.values()]
          .filter(
            (row) =>
              row.participant_id === params.participant_id &&
              isAfterSince(
                typeof row.captured_at === "string"
                  ? row.captured_at
                  : undefined,
              ),
          )
          .map((row) => row.record_id),
      });
    },
  },
  {
    method: "GET",
    pattern: "/participants/:participant_id/compliance",
    handler: async ({ request, response, params }) => {
      if (!hasApiKey(request.headers)) {
        writeJson(response, 401, { error: "API key required" });
        return;
      }

      const participant = await getParticipant(params.participant_id);
      if (!participant) {
        writeJson(response, 404, { error: "Participant not found" });
        return;
      }

      if (DATABASE_ENABLED) {
        writeJson(
          response,
          200,
          await getComplianceRecord({
            participant_id: params.participant_id,
            study_id: participant.study_id,
          }),
        );
        return;
      }

      const rows = [...promptLogs.values()].filter(
        (row) => row.participant_id === params.participant_id,
      );
      const totalPromptsScheduled = rows.length;
      const totalCompleted = rows.filter(
        (row) => row.status === "completed",
      ).length;
      const totalSent = rows.filter((row) => row.status === "sent").length;
      const totalQuitEarly = rows.filter(
        (row) => row.status === "quit_early",
      ).length;
      const totalMissed = rows.filter((row) => row.status === "missed").length;
      const totalExpired = rows.filter(
        (row) => row.status === "expired",
      ).length;
      const lastPromptAt =
        rows
          .map((row) =>
            typeof row.assessment_ended_at === "string"
              ? row.assessment_ended_at
              : typeof row.opened_at === "string"
                ? row.opened_at
                : typeof row.sent_at === "string"
                  ? row.sent_at
                  : null,
          )
          .filter((value): value is string => typeof value === "string")
          .sort()
          .at(-1) ?? null;

      writeJson(response, 200, {
        participant_id: params.participant_id,
        study_id: participant.study_id,
        total_prompts_scheduled: totalPromptsScheduled,
        total_sent: totalSent,
        total_completed: totalCompleted,
        total_quit_early: totalQuitEarly,
        total_missed: totalMissed,
        total_expired: totalExpired,
        completed_prompts: totalCompleted,
        missed_prompts: totalMissed,
        last_prompt_at: lastPromptAt,
        response_rate:
          totalPromptsScheduled === 0
            ? 0
            : (totalCompleted + totalQuitEarly) / totalPromptsScheduled,
        completion_rate:
          totalPromptsScheduled === 0
            ? 0
            : totalCompleted / totalPromptsScheduled,
        mean_response_latency_ms: null,
      });
    },
  },
  {
    method: "POST",
    pattern: "/studies/:study_id/export",
    handler: async ({ request, response, params, body }) => {
      if (!hasApiKey(request.headers)) {
        writeJson(response, 401, { error: "API key required" });
        return;
      }

      const payload = body as { format?: unknown } | null;
      const format = payload?.format === "csv" ? "csv" : "json";
      const jobId = randomUUID();
      if (DATABASE_ENABLED) {
        await createExportJobRecord({
          job_id: jobId,
          study_id: params.study_id,
          format,
          status: "pending",
        });
      } else {
        const now = new Date().toISOString();
        exportJobs.set(jobId, {
          job_id: jobId,
          study_id: params.study_id,
          format,
          status: "pending",
          created_at: now,
          updated_at: now,
        });
        await persistState();
      }

      queueMicrotask(() => {
        if (DATABASE_ENABLED) {
          void updateExportJobRecord(jobId, {
            status: "ready",
            download_url: `/exports/${jobId}.zip`,
          });
          return;
        }

        const job = exportJobs.get(jobId);
        if (!job) return;
        job.status = "ready";
        job.download_url = `/exports/${jobId}.zip`;
        job.updated_at = new Date().toISOString();
        void persistState();
      });

      writeJson(response, 202, { job_id: jobId });
    },
  },
  {
    method: "GET",
    pattern: "/export-jobs/:job_id",
    handler: async ({ request, response, params }) => {
      if (!hasApiKey(request.headers)) {
        writeJson(response, 401, { error: "API key required" });
        return;
      }

      const job = DATABASE_ENABLED
        ? await getExportJobRecord(params.job_id)
        : (exportJobs.get(params.job_id) ?? null);
      if (!job) {
        writeJson(response, 404, { error: "Export job not found" });
        return;
      }

      writeJson(response, 200, {
        status: job.status,
        download_url: job.download_url,
      });
    },
  },
];

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
) {
  const url = new URL(request.url ?? "/", "http://localhost");
  const pathname = url.pathname.startsWith(API_PREFIX)
    ? url.pathname.slice(API_PREFIX.length) || "/"
    : url.pathname;
  const route = routes.find(
    (candidate) =>
      candidate.method === (request.method ?? "GET") &&
      matchPath(candidate.pattern, pathname) !== null,
  );

  if (!route) {
    writeJson(response, 404, { error: "Not found" });
    return;
  }

  const params = matchPath(route.pattern, pathname) ?? {};
  const body =
    request.method === "GET" || request.method === "HEAD"
      ? null
      : await readJsonBody(request).catch(() => null);

  try {
    await route.handler({
      request,
      response,
      params,
      query: url.searchParams,
      body,
    });
  } catch (error) {
    console.error("[ema-server] request failed", error);
    writeJson(response, 500, { error: "Internal server error" });
  }
}

await hydrateState();
await seedDemoProtocol();

const server = createServer((request, response) => {
  void handleRequest(request, response);
});

server.listen(PORT, () => {
  console.log(`[ema-server] listening on http://localhost:${PORT}`);
  console.log(`[ema-server] auth: EMA_API_KEY=${API_KEY}`);
});
