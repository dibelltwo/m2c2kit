import "./env.js";
import { Prisma } from "@prisma/client";
import { prisma } from "./db/prisma.js";

export type StudyProtocol = Record<string, unknown>;

export type ParticipantRecord = {
  participant_id: string;
  study_id: string;
  token: string;
  enrolled_at: string;
  device_id?: string;
};

export type StoredProtocol = {
  study_id: string;
  version: number;
  protocol: StudyProtocol;
  updated_at: string;
};

export type PromptLogEntry = {
  prompt_id: string;
  participant_id?: string;
  study_id?: string;
  status?: string;
  [key: string]: unknown;
};

export type ContextSnapshot = {
  snapshot_id: string;
  participant_id?: string;
  [key: string]: unknown;
};

export type SurveyResponse = {
  record_id: string;
  participant_id?: string;
  [key: string]: unknown;
};

export type SessionUpload = {
  session_uuid: string;
  participant_id: string;
  study_id: string;
  prompt_id: string;
  protocol_version?: number | null;
  activity_id: string;
  activity_version?: string;
  started_at?: string;
  ended_at?: string;
  canceled?: boolean;
  trials: Record<string, unknown>[];
  scoring: Record<string, unknown>[];
};

export type ExportJob = {
  job_id: string;
  study_id: string;
  format: "csv" | "json";
  status: "pending" | "running" | "ready" | "failed";
  download_url?: string;
  error?: string;
  created_at: string;
  updated_at: string;
};

export type ExportDataset = {
  study_id: string;
  exported_at: string;
  protocol_versions: StoredProtocol[];
  participants: Array<Omit<ParticipantRecord, "token">>;
  sessions: SessionUpload[];
  prompt_logs: PromptLogEntry[];
  context_snapshots: ContextSnapshot[];
  survey_responses: SurveyResponse[];
};

export type ProtocolVersionSummary = {
  version: number;
  updated_at: string;
};

export type BackendCounts = {
  participants: number;
  protocol_versions: number;
  sessions: number;
  prompt_logs: number;
  context_snapshots: number;
  survey_responses: number;
  export_jobs: number;
};

export type StudySummary = {
  study_id: string;
  participant_count: number;
  session_count: number;
  prompt_log_count: number;
  survey_response_count: number;
  context_snapshot_count: number;
  protocol_version_count: number;
  export_job_count: number;
  latest_protocol_updated_at: string | null;
  latest_session_at: string | null;
  latest_export_status: string | null;
  latest_export_job_id: string | null;
};

const DATABASE_ENABLED = Boolean(process.env.DATABASE_URL);

function toParticipantRecord(row: {
  participant_id: string;
  study_id: string;
  token: string;
  enrolled_at: Date;
  device_id: string | null;
}): ParticipantRecord {
  return {
    participant_id: row.participant_id,
    study_id: row.study_id,
    token: row.token,
    enrolled_at: row.enrolled_at.toISOString(),
    device_id: row.device_id ?? undefined,
  };
}

function toStoredProtocol(row: {
  study_id: string;
  version: number;
  protocol_json: unknown;
  updated_at: Date;
}): StoredProtocol {
  return {
    study_id: row.study_id,
    version: row.version,
    protocol: row.protocol_json as StudyProtocol,
    updated_at: row.updated_at.toISOString(),
  };
}

function toExportJob(row: {
  job_id: string;
  study_id: string;
  format: string;
  status: string;
  download_url: string | null;
  error: string | null;
  created_at: Date;
  updated_at: Date;
}): ExportJob {
  return {
    job_id: row.job_id,
    study_id: row.study_id,
    format: row.format === "csv" ? "csv" : "json",
    status:
      row.status === "running" ||
      row.status === "ready" ||
      row.status === "failed"
        ? row.status
        : "pending",
    download_url: row.download_url ?? undefined,
    error: row.error ?? undefined,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

export function isDatabaseEnabled(): boolean {
  return DATABASE_ENABLED;
}

function parseDate(value: unknown): Date | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function toSessionUpload(row: {
  session_uuid: string;
  participant_id: string;
  study_id: string;
  prompt_id: string;
  protocol_version: number | null;
  activity_id: string;
  activity_version: string | null;
  started_at: Date | null;
  ended_at: Date | null;
  canceled: boolean | null;
  trials_json: Prisma.JsonValue;
  scoring_json: Prisma.JsonValue;
}): SessionUpload {
  return {
    session_uuid: row.session_uuid,
    participant_id: row.participant_id,
    study_id: row.study_id,
    prompt_id: row.prompt_id,
    protocol_version: row.protocol_version,
    activity_id: row.activity_id,
    activity_version: row.activity_version ?? undefined,
    started_at: row.started_at?.toISOString(),
    ended_at: row.ended_at?.toISOString(),
    canceled: row.canceled ?? undefined,
    trials: Array.isArray(row.trials_json)
      ? (row.trials_json as Record<string, unknown>[])
      : [],
    scoring: Array.isArray(row.scoring_json)
      ? (row.scoring_json as Record<string, unknown>[])
      : [],
  };
}

function toPromptLogEntry(row: {
  prompt_id: string;
  participant_id: string;
  study_id: string | null;
  protocol_version: number | null;
  session_uuid: string | null;
  scheduled_for: Date | null;
  sent_at: Date | null;
  opened_at: Date | null;
  assessment_started_at: Date | null;
  assessment_ended_at: Date | null;
  status: string | null;
  quit_early: boolean;
  n_trials_completed: number | null;
  context_snapshot_id: string | null;
}): PromptLogEntry {
  return {
    prompt_id: row.prompt_id,
    participant_id: row.participant_id,
    study_id: row.study_id ?? undefined,
    protocol_version: row.protocol_version ?? undefined,
    session_uuid: row.session_uuid ?? undefined,
    scheduled_for: row.scheduled_for?.toISOString(),
    sent_at: row.sent_at?.toISOString(),
    opened_at: row.opened_at?.toISOString(),
    assessment_started_at: row.assessment_started_at?.toISOString(),
    assessment_ended_at: row.assessment_ended_at?.toISOString(),
    status: row.status ?? undefined,
    quit_early: row.quit_early,
    n_trials_completed: row.n_trials_completed ?? undefined,
    context_snapshot_id: row.context_snapshot_id ?? undefined,
  };
}

function toContextSnapshot(row: {
  snapshot_id: string;
  prompt_id: string | null;
  participant_id: string;
  study_id: string | null;
  protocol_version: number | null;
  captured_at: Date | null;
  latitude: number | null;
  longitude: number | null;
  gps_accuracy_meters: number | null;
  battery_level: number | null;
  is_charging: boolean | null;
  network_type: string | null;
  payload_json: Prisma.JsonValue | null;
}): ContextSnapshot {
  return {
    snapshot_id: row.snapshot_id,
    prompt_id: row.prompt_id ?? undefined,
    participant_id: row.participant_id,
    study_id: row.study_id ?? undefined,
    protocol_version: row.protocol_version ?? undefined,
    captured_at: row.captured_at?.toISOString(),
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    gps_accuracy_meters: row.gps_accuracy_meters ?? undefined,
    battery_level: row.battery_level ?? undefined,
    is_charging: row.is_charging ?? undefined,
    network_type: row.network_type ?? undefined,
    payload_json: row.payload_json ?? undefined,
  };
}

function toSurveyResponse(row: {
  record_id: string;
  session_uuid: string | null;
  prompt_id: string | null;
  participant_id: string;
  study_id: string | null;
  protocol_version: number | null;
  survey_id: string;
  survey_version: number | null;
  item_id: string;
  response_status: string;
  response_value: Prisma.JsonValue | null;
  captured_at: Date | null;
}): SurveyResponse {
  return {
    record_id: row.record_id,
    session_uuid: row.session_uuid ?? undefined,
    prompt_id: row.prompt_id ?? undefined,
    participant_id: row.participant_id,
    study_id: row.study_id ?? undefined,
    protocol_version: row.protocol_version ?? undefined,
    survey_id: row.survey_id,
    survey_version: row.survey_version ?? undefined,
    item_id: row.item_id,
    response_status: row.response_status,
    response_value: row.response_value ?? undefined,
    captured_at: row.captured_at?.toISOString(),
  };
}

function toExportParticipant(
  participant: ParticipantRecord,
): Omit<ParticipantRecord, "token"> {
  return {
    participant_id: participant.participant_id,
    study_id: participant.study_id,
    enrolled_at: participant.enrolled_at,
    device_id: participant.device_id,
  };
}

export async function ensureStudyExists(studyId: string): Promise<void> {
  if (!DATABASE_ENABLED) {
    return;
  }

  await prisma.study.upsert({
    where: { study_id: studyId },
    update: {},
    create: { study_id: studyId },
  });
}

export async function getParticipantRecord(
  participantId: string,
): Promise<ParticipantRecord | null> {
  if (!DATABASE_ENABLED) {
    return null;
  }

  const row = await prisma.participant.findUnique({
    where: { participant_id: participantId },
  });
  return row ? toParticipantRecord(row) : null;
}

export async function listParticipantRecords(
  studyId?: string,
): Promise<ParticipantRecord[]> {
  if (!DATABASE_ENABLED) {
    return [];
  }

  const rows = await prisma.participant.findMany({
    where: studyId ? { study_id: studyId } : undefined,
    orderBy: { enrolled_at: "asc" },
  });
  return rows.map(toParticipantRecord);
}

export async function createParticipantRecord(input: {
  participant_id: string;
  study_id: string;
  token: string;
  device_id?: string;
}): Promise<ParticipantRecord> {
  await ensureStudyExists(input.study_id);
  if (!DATABASE_ENABLED) {
    return {
      participant_id: input.participant_id,
      study_id: input.study_id,
      token: input.token,
      enrolled_at: new Date().toISOString(),
      device_id: input.device_id,
    };
  }

  const row = await prisma.participant.create({
    data: {
      participant_id: input.participant_id,
      study_id: input.study_id,
      token: input.token,
      device_id: input.device_id,
    },
  });
  return toParticipantRecord(row);
}

export async function getStoredProtocolRecord(
  studyId: string,
): Promise<StoredProtocol | null> {
  if (!DATABASE_ENABLED) {
    return null;
  }

  const row = await prisma.studyProtocolVersion.findFirst({
    where: { study_id: studyId },
    orderBy: [{ version: "desc" }],
  });
  return row ? toStoredProtocol(row) : null;
}

export async function saveStoredProtocolRecord(input: {
  study_id: string;
  version: number;
  protocol: StudyProtocol;
}): Promise<StoredProtocol> {
  await ensureStudyExists(input.study_id);
  if (!DATABASE_ENABLED) {
    return {
      study_id: input.study_id,
      version: input.version,
      protocol: input.protocol,
      updated_at: new Date().toISOString(),
    };
  }

  const row = await prisma.studyProtocolVersion.create({
    data: {
      study_id: input.study_id,
      version: input.version,
      protocol_json: input.protocol as Prisma.InputJsonValue,
    },
  });
  return toStoredProtocol(row);
}

export async function createExportJobRecord(input: {
  job_id: string;
  study_id: string;
  format: "csv" | "json";
  status: "pending" | "running" | "ready" | "failed";
}): Promise<ExportJob> {
  await ensureStudyExists(input.study_id);
  if (!DATABASE_ENABLED) {
    const now = new Date().toISOString();
    return {
      ...input,
      created_at: now,
      updated_at: now,
    };
  }

  const row = await prisma.exportJob.create({
    data: {
      job_id: input.job_id,
      study_id: input.study_id,
      format: input.format,
      status: input.status,
    },
  });
  return toExportJob(row);
}

export async function updateExportJobRecord(
  jobId: string,
  input: {
    status: "pending" | "running" | "ready" | "failed";
    download_url?: string;
    error?: string;
  },
): Promise<ExportJob | null> {
  if (!DATABASE_ENABLED) {
    return null;
  }

  const row = await prisma.exportJob.update({
    where: { job_id: jobId },
    data: {
      status: input.status,
      download_url: input.download_url,
      error: input.error,
    },
  });
  return toExportJob(row);
}

export async function getExportJobRecord(
  jobId: string,
): Promise<ExportJob | null> {
  if (!DATABASE_ENABLED) {
    return null;
  }

  const row = await prisma.exportJob.findUnique({
    where: { job_id: jobId },
  });
  return row ? toExportJob(row) : null;
}

export async function getStudyExportDataset(
  studyId: string,
): Promise<ExportDataset | null> {
  if (!DATABASE_ENABLED) {
    return null;
  }

  const study = await prisma.study.findUnique({
    where: { study_id: studyId },
    select: { study_id: true },
  });
  if (!study) {
    return null;
  }

  const [
    protocolVersions,
    participants,
    sessions,
    promptLogs,
    contextSnapshots,
    surveyResponses,
  ] = await Promise.all([
    prisma.studyProtocolVersion.findMany({
      where: { study_id: studyId },
      orderBy: [{ version: "asc" }],
    }),
    prisma.participant.findMany({
      where: { study_id: studyId },
      orderBy: [{ enrolled_at: "asc" }],
    }),
    prisma.sessionUpload.findMany({
      where: { study_id: studyId },
      orderBy: [{ uploaded_at: "asc" }],
    }),
    prisma.promptLog.findMany({
      where: { study_id: studyId },
      orderBy: [{ uploaded_at: "asc" }],
    }),
    prisma.contextSnapshot.findMany({
      where: { study_id: studyId },
      orderBy: [{ uploaded_at: "asc" }],
    }),
    prisma.surveyItemResponse.findMany({
      where: { study_id: studyId },
      orderBy: [{ uploaded_at: "asc" }],
    }),
  ]);

  return {
    study_id: studyId,
    exported_at: new Date().toISOString(),
    protocol_versions: protocolVersions.map(toStoredProtocol),
    participants: participants.map((participant) =>
      toExportParticipant(toParticipantRecord(participant)),
    ),
    sessions: sessions.map(toSessionUpload),
    prompt_logs: promptLogs.map(toPromptLogEntry),
    context_snapshots: contextSnapshots.map(toContextSnapshot),
    survey_responses: surveyResponses.map(toSurveyResponse),
  };
}

export async function listStudyProtocolVersions(
  studyId: string,
): Promise<ProtocolVersionSummary[]> {
  if (!DATABASE_ENABLED) {
    return [];
  }

  const rows = await prisma.studyProtocolVersion.findMany({
    where: { study_id: studyId },
    orderBy: [{ version: "desc" }],
    select: { version: true, updated_at: true },
  });
  return rows.map((row) => ({
    version: row.version,
    updated_at: row.updated_at.toISOString(),
  }));
}

export async function getBackendCounts(): Promise<BackendCounts | null> {
  if (!DATABASE_ENABLED) {
    return null;
  }

  const [
    participants,
    protocol_versions,
    sessions,
    prompt_logs,
    context_snapshots,
    survey_responses,
    export_jobs,
  ] = await Promise.all([
    prisma.participant.count(),
    prisma.studyProtocolVersion.count(),
    prisma.sessionUpload.count(),
    prisma.promptLog.count(),
    prisma.contextSnapshot.count(),
    prisma.surveyItemResponse.count(),
    prisma.exportJob.count(),
  ]);

  return {
    participants,
    protocol_versions,
    sessions,
    prompt_logs,
    context_snapshots,
    survey_responses,
    export_jobs,
  };
}

export async function getStudySummaryRecord(
  studyId: string,
): Promise<StudySummary | null> {
  if (!DATABASE_ENABLED) {
    return null;
  }

  const [
    study,
    participants,
    sessions,
    promptLogs,
    contextSnapshots,
    surveyResponses,
    protocolVersions,
    exportJobs,
  ] = await Promise.all([
    prisma.study.findUnique({
      where: { study_id: studyId },
      select: { study_id: true },
    }),
    prisma.participant.count({ where: { study_id: studyId } }),
    prisma.sessionUpload.findMany({
      where: { study_id: studyId },
      orderBy: [{ uploaded_at: "desc" }],
      select: { uploaded_at: true },
    }),
    prisma.promptLog.count({ where: { study_id: studyId } }),
    prisma.contextSnapshot.count({ where: { study_id: studyId } }),
    prisma.surveyItemResponse.count({ where: { study_id: studyId } }),
    prisma.studyProtocolVersion.findMany({
      where: { study_id: studyId },
      orderBy: [{ updated_at: "desc" }],
      select: { updated_at: true },
    }),
    prisma.exportJob.findMany({
      where: { study_id: studyId },
      orderBy: [{ updated_at: "desc" }],
      select: { job_id: true, status: true },
    }),
  ]);

  if (!study) {
    return null;
  }

  return {
    study_id: studyId,
    participant_count: participants,
    session_count: sessions.length,
    prompt_log_count: promptLogs,
    survey_response_count: surveyResponses,
    context_snapshot_count: contextSnapshots,
    protocol_version_count: protocolVersions.length,
    export_job_count: exportJobs.length,
    latest_protocol_updated_at:
      protocolVersions[0]?.updated_at.toISOString() ?? null,
    latest_session_at: sessions[0]?.uploaded_at.toISOString() ?? null,
    latest_export_status: exportJobs[0]?.status ?? null,
    latest_export_job_id: exportJobs[0]?.job_id ?? null,
  };
}

export async function upsertSessionUploadRecord(
  input: SessionUpload,
): Promise<{ duplicate: boolean }> {
  if (!DATABASE_ENABLED) {
    return { duplicate: false };
  }

  const duplicate = Boolean(
    await prisma.sessionUpload.findUnique({
      where: { session_uuid: input.session_uuid },
      select: { session_uuid: true },
    }),
  );

  await prisma.sessionUpload.upsert({
    where: { session_uuid: input.session_uuid },
    update: {
      participant_id: input.participant_id,
      study_id: input.study_id,
      prompt_id: input.prompt_id,
      protocol_version: input.protocol_version ?? null,
      activity_id: input.activity_id,
      activity_version: input.activity_version,
      started_at: parseDate(input.started_at) ?? null,
      ended_at: parseDate(input.ended_at) ?? null,
      canceled: input.canceled ?? null,
      trials_json: input.trials as Prisma.InputJsonValue,
      scoring_json: input.scoring as Prisma.InputJsonValue,
    },
    create: {
      session_uuid: input.session_uuid,
      participant_id: input.participant_id,
      study_id: input.study_id,
      prompt_id: input.prompt_id,
      protocol_version: input.protocol_version ?? null,
      activity_id: input.activity_id,
      activity_version: input.activity_version,
      started_at: parseDate(input.started_at) ?? null,
      ended_at: parseDate(input.ended_at) ?? null,
      canceled: input.canceled ?? null,
      trials_json: input.trials as Prisma.InputJsonValue,
      scoring_json: input.scoring as Prisma.InputJsonValue,
    },
  });

  return { duplicate };
}

export async function upsertPromptLogRecords(
  entries: PromptLogEntry[],
): Promise<number> {
  if (!DATABASE_ENABLED || entries.length === 0) {
    return 0;
  }

  const existing = await prisma.promptLog.findMany({
    where: { prompt_id: { in: entries.map((entry) => entry.prompt_id) } },
    select: { prompt_id: true },
  });
  const existingIds = new Set(existing.map((entry) => entry.prompt_id));

  for (const entry of entries) {
    if (typeof entry.participant_id !== "string") {
      continue;
    }
    await prisma.promptLog.upsert({
      where: { prompt_id: entry.prompt_id },
      update: {
        participant_id: entry.participant_id,
        study_id: typeof entry.study_id === "string" ? entry.study_id : null,
        protocol_version:
          typeof entry.protocol_version === "number"
            ? entry.protocol_version
            : null,
        session_uuid:
          typeof entry.session_uuid === "string" ? entry.session_uuid : null,
        scheduled_for: parseDate(entry.scheduled_for) ?? null,
        sent_at: parseDate(entry.sent_at) ?? null,
        opened_at: parseDate(entry.opened_at) ?? null,
        assessment_started_at: parseDate(entry.assessment_started_at) ?? null,
        assessment_ended_at: parseDate(entry.assessment_ended_at) ?? null,
        status: typeof entry.status === "string" ? entry.status : null,
        quit_early: entry.status === "quit_early" || entry.quit_early === true,
        n_trials_completed:
          typeof entry.n_trials_completed === "number"
            ? entry.n_trials_completed
            : null,
        context_snapshot_id:
          typeof entry.context_snapshot_id === "string"
            ? entry.context_snapshot_id
            : null,
      },
      create: {
        prompt_id: entry.prompt_id,
        participant_id: entry.participant_id,
        study_id: typeof entry.study_id === "string" ? entry.study_id : null,
        protocol_version:
          typeof entry.protocol_version === "number"
            ? entry.protocol_version
            : null,
        session_uuid:
          typeof entry.session_uuid === "string" ? entry.session_uuid : null,
        scheduled_for: parseDate(entry.scheduled_for) ?? null,
        sent_at: parseDate(entry.sent_at) ?? null,
        opened_at: parseDate(entry.opened_at) ?? null,
        assessment_started_at: parseDate(entry.assessment_started_at) ?? null,
        assessment_ended_at: parseDate(entry.assessment_ended_at) ?? null,
        status: typeof entry.status === "string" ? entry.status : null,
        quit_early: entry.status === "quit_early" || entry.quit_early === true,
        n_trials_completed:
          typeof entry.n_trials_completed === "number"
            ? entry.n_trials_completed
            : null,
        context_snapshot_id:
          typeof entry.context_snapshot_id === "string"
            ? entry.context_snapshot_id
            : null,
      },
    });
  }

  return entries.filter((entry) => !existingIds.has(entry.prompt_id)).length;
}

export async function upsertContextSnapshotRecords(
  rows: ContextSnapshot[],
): Promise<number> {
  if (!DATABASE_ENABLED || rows.length === 0) {
    return 0;
  }

  const existing = await prisma.contextSnapshot.findMany({
    where: { snapshot_id: { in: rows.map((row) => row.snapshot_id) } },
    select: { snapshot_id: true },
  });
  const existingIds = new Set(existing.map((row) => row.snapshot_id));

  for (const row of rows) {
    if (typeof row.participant_id !== "string") {
      continue;
    }
    await prisma.contextSnapshot.upsert({
      where: { snapshot_id: row.snapshot_id },
      update: {
        prompt_id: typeof row.prompt_id === "string" ? row.prompt_id : null,
        participant_id: row.participant_id,
        study_id: typeof row.study_id === "string" ? row.study_id : null,
        protocol_version:
          typeof row.protocol_version === "number"
            ? row.protocol_version
            : null,
        captured_at: parseDate(row.captured_at) ?? null,
        latitude: typeof row.latitude === "number" ? row.latitude : null,
        longitude: typeof row.longitude === "number" ? row.longitude : null,
        gps_accuracy_meters:
          typeof row.gps_accuracy_meters === "number"
            ? row.gps_accuracy_meters
            : null,
        battery_level:
          typeof row.battery_level === "number" ? row.battery_level : null,
        is_charging:
          typeof row.is_charging === "boolean" ? row.is_charging : null,
        network_type:
          typeof row.network_type === "string" ? row.network_type : null,
        payload_json:
          row.payload_json !== undefined
            ? (row.payload_json as Prisma.InputJsonValue)
            : Prisma.JsonNull,
      },
      create: {
        snapshot_id: row.snapshot_id,
        prompt_id: typeof row.prompt_id === "string" ? row.prompt_id : null,
        participant_id: row.participant_id,
        study_id: typeof row.study_id === "string" ? row.study_id : null,
        protocol_version:
          typeof row.protocol_version === "number"
            ? row.protocol_version
            : null,
        captured_at: parseDate(row.captured_at) ?? null,
        latitude: typeof row.latitude === "number" ? row.latitude : null,
        longitude: typeof row.longitude === "number" ? row.longitude : null,
        gps_accuracy_meters:
          typeof row.gps_accuracy_meters === "number"
            ? row.gps_accuracy_meters
            : null,
        battery_level:
          typeof row.battery_level === "number" ? row.battery_level : null,
        is_charging:
          typeof row.is_charging === "boolean" ? row.is_charging : null,
        network_type:
          typeof row.network_type === "string" ? row.network_type : null,
        payload_json:
          row.payload_json !== undefined
            ? (row.payload_json as Prisma.InputJsonValue)
            : Prisma.JsonNull,
      },
    });
  }

  return rows.filter((row) => !existingIds.has(row.snapshot_id)).length;
}

export async function upsertSurveyResponseRecords(
  rows: SurveyResponse[],
): Promise<number> {
  if (!DATABASE_ENABLED || rows.length === 0) {
    return 0;
  }

  const existing = await prisma.surveyItemResponse.findMany({
    where: { record_id: { in: rows.map((row) => row.record_id) } },
    select: { record_id: true },
  });
  const existingIds = new Set(existing.map((row) => row.record_id));

  for (const row of rows) {
    if (
      typeof row.participant_id !== "string" ||
      typeof row.survey_id !== "string"
    ) {
      continue;
    }
    await prisma.surveyItemResponse.upsert({
      where: { record_id: row.record_id },
      update: {
        session_uuid:
          typeof row.session_uuid === "string" ? row.session_uuid : null,
        prompt_id: typeof row.prompt_id === "string" ? row.prompt_id : null,
        participant_id: row.participant_id,
        study_id: typeof row.study_id === "string" ? row.study_id : null,
        protocol_version:
          typeof row.protocol_version === "number"
            ? row.protocol_version
            : null,
        survey_id: row.survey_id,
        survey_version:
          typeof row.survey_version === "number" ? row.survey_version : null,
        item_id: typeof row.item_id === "string" ? row.item_id : "",
        response_status:
          typeof row.response_status === "string"
            ? row.response_status
            : "unknown",
        response_value:
          row.response_value !== undefined
            ? (row.response_value as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        captured_at: parseDate(row.captured_at) ?? null,
      },
      create: {
        record_id: row.record_id,
        session_uuid:
          typeof row.session_uuid === "string" ? row.session_uuid : null,
        prompt_id: typeof row.prompt_id === "string" ? row.prompt_id : null,
        participant_id: row.participant_id,
        study_id: typeof row.study_id === "string" ? row.study_id : null,
        protocol_version:
          typeof row.protocol_version === "number"
            ? row.protocol_version
            : null,
        survey_id: row.survey_id,
        survey_version:
          typeof row.survey_version === "number" ? row.survey_version : null,
        item_id: typeof row.item_id === "string" ? row.item_id : "",
        response_status:
          typeof row.response_status === "string"
            ? row.response_status
            : "unknown",
        response_value:
          row.response_value !== undefined
            ? (row.response_value as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        captured_at: parseDate(row.captured_at) ?? null,
      },
    });
  }

  return rows.filter((row) => !existingIds.has(row.record_id)).length;
}

export async function getLastSyncAtRecord(
  participantId: string,
): Promise<string | null> {
  if (!DATABASE_ENABLED) {
    return null;
  }

  const row = await prisma.sessionUpload.findFirst({
    where: { participant_id: participantId },
    orderBy: [{ ended_at: "desc" }, { started_at: "desc" }],
    select: { ended_at: true, started_at: true },
  });
  return row?.ended_at?.toISOString() ?? row?.started_at?.toISOString() ?? null;
}

export async function getSyncStatusRecordIds(input: {
  participant_id: string;
  since?: string | null;
}): Promise<{
  session_uuids: string[];
  prompt_ids: string[];
  snapshot_ids: string[];
  survey_response_ids: string[];
}> {
  if (!DATABASE_ENABLED) {
    return {
      session_uuids: [],
      prompt_ids: [],
      snapshot_ids: [],
      survey_response_ids: [],
    };
  }

  const sinceDate = parseDate(input.since ?? undefined);
  const sessions = await prisma.sessionUpload.findMany({
    where: {
      participant_id: input.participant_id,
      ...(sinceDate
        ? {
            OR: [
              { ended_at: { gte: sinceDate } },
              { started_at: { gte: sinceDate } },
            ],
          }
        : {}),
    },
    select: { session_uuid: true },
  });
  const promptLogs = await prisma.promptLog.findMany({
    where: {
      participant_id: input.participant_id,
      ...(sinceDate
        ? {
            OR: [
              { assessment_ended_at: { gte: sinceDate } },
              { opened_at: { gte: sinceDate } },
              { sent_at: { gte: sinceDate } },
            ],
          }
        : {}),
    },
    select: { prompt_id: true },
  });
  const snapshots = await prisma.contextSnapshot.findMany({
    where: {
      participant_id: input.participant_id,
      ...(sinceDate ? { captured_at: { gte: sinceDate } } : {}),
    },
    select: { snapshot_id: true },
  });
  const surveyResponses = await prisma.surveyItemResponse.findMany({
    where: {
      participant_id: input.participant_id,
      ...(sinceDate ? { captured_at: { gte: sinceDate } } : {}),
    },
    select: { record_id: true },
  });

  return {
    session_uuids: sessions.map((row) => row.session_uuid),
    prompt_ids: promptLogs.map((row) => row.prompt_id),
    snapshot_ids: snapshots.map((row) => row.snapshot_id),
    survey_response_ids: surveyResponses.map((row) => row.record_id),
  };
}

export async function getComplianceRecord(input: {
  participant_id: string;
  study_id: string;
}): Promise<{
  participant_id: string;
  study_id: string;
  total_prompts_scheduled: number;
  total_sent: number;
  total_completed: number;
  total_quit_early: number;
  total_missed: number;
  total_expired: number;
  completed_prompts: number;
  missed_prompts: number;
  last_prompt_at: string | null;
  response_rate: number;
  completion_rate: number;
  mean_response_latency_ms: number | null;
}> {
  const empty = {
    participant_id: input.participant_id,
    study_id: input.study_id,
    total_prompts_scheduled: 0,
    total_sent: 0,
    total_completed: 0,
    total_quit_early: 0,
    total_missed: 0,
    total_expired: 0,
    completed_prompts: 0,
    missed_prompts: 0,
    last_prompt_at: null,
    response_rate: 0,
    completion_rate: 0,
    mean_response_latency_ms: null,
  };
  if (!DATABASE_ENABLED) {
    return empty;
  }

  const rows = await prisma.promptLog.findMany({
    where: { participant_id: input.participant_id },
  });
  const totalPromptsScheduled = rows.length;
  const totalSent = rows.filter((row) => row.status === "sent").length;
  const totalCompleted = rows.filter(
    (row) => row.status === "completed",
  ).length;
  const totalQuitEarly = rows.filter(
    (row) => row.status === "quit_early",
  ).length;
  const totalMissed = rows.filter((row) => row.status === "missed").length;
  const totalExpired = rows.filter((row) => row.status === "expired").length;

  const latencies = rows
    .map((row) => {
      if (!row.sent_at || !row.assessment_started_at) {
        return null;
      }
      return row.assessment_started_at.getTime() - row.sent_at.getTime();
    })
    .filter(
      (value): value is number => typeof value === "number" && value >= 0,
    );

  const meanResponseLatency =
    latencies.length > 0
      ? latencies.reduce((sum, value) => sum + value, 0) / latencies.length
      : null;
  const lastPromptAt =
    rows
      .map(
        (row) =>
          row.assessment_ended_at?.toISOString() ??
          row.opened_at?.toISOString() ??
          row.sent_at?.toISOString() ??
          null,
      )
      .filter((value): value is string => typeof value === "string")
      .sort()
      .at(-1) ?? null;

  return {
    participant_id: input.participant_id,
    study_id: input.study_id,
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
      totalPromptsScheduled === 0 ? 0 : totalCompleted / totalPromptsScheduled,
    mean_response_latency_ms: meanResponseLatency,
  };
}
