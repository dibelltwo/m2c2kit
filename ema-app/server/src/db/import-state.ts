import "../env.js";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { prisma } from "./prisma.js";
import { loadPersistedState } from "../persistence.js";

function parseDate(value: unknown): Date | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

async function main() {
  const state = await loadPersistedState();

  const studyIds = new Set<string>();
  for (const row of [
    ...state.participants,
    ...state.studyProtocols,
    ...state.promptLogs,
    ...state.contextSnapshots,
    ...state.surveyResponses,
    ...state.sessions,
    ...state.exportJobs,
  ]) {
    const studyId = (row as { study_id?: unknown }).study_id;
    if (typeof studyId === "string" && studyId) {
      studyIds.add(studyId);
    }
  }

  for (const studyId of studyIds) {
    await prisma.study.upsert({
      where: { study_id: studyId },
      update: {},
      create: { study_id: studyId },
    });
  }

  await prisma.participant.createMany({
    data: state.participants
      .map((row) => {
        const participant = row as {
          participant_id?: unknown;
          study_id?: unknown;
          token?: unknown;
          enrolled_at?: unknown;
          device_id?: unknown;
        };
        if (
          typeof participant.participant_id !== "string" ||
          typeof participant.study_id !== "string" ||
          typeof participant.token !== "string"
        ) {
          return null;
        }

        return {
          participant_id: participant.participant_id,
          study_id: participant.study_id,
          token: participant.token,
          enrolled_at: parseDate(participant.enrolled_at) ?? new Date(),
          device_id:
            typeof participant.device_id === "string"
              ? participant.device_id
              : null,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null),
    skipDuplicates: true,
  });

  await prisma.studyProtocolVersion.createMany({
    data: state.studyProtocols
      .map((row) => {
        const protocol = row as {
          study_id?: unknown;
          version?: unknown;
          protocol?: unknown;
          updated_at?: unknown;
        };
        if (
          typeof protocol.study_id !== "string" ||
          typeof protocol.version !== "number"
        ) {
          return null;
        }

        return {
          id: randomUUID(),
          study_id: protocol.study_id,
          version: protocol.version,
          protocol_json: protocol.protocol as Prisma.InputJsonValue,
          created_at: parseDate(protocol.updated_at) ?? new Date(),
          updated_at: parseDate(protocol.updated_at) ?? new Date(),
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null),
    skipDuplicates: true,
  });

  await prisma.sessionUpload.createMany({
    data: state.sessions
      .map((row) => {
        const session = row as {
          session_uuid?: unknown;
          participant_id?: unknown;
          study_id?: unknown;
          prompt_id?: unknown;
          protocol_version?: unknown;
          activity_id?: unknown;
          activity_version?: unknown;
          started_at?: unknown;
          ended_at?: unknown;
          canceled?: unknown;
          trials?: unknown;
          scoring?: unknown;
        };
        if (
          typeof session.session_uuid !== "string" ||
          typeof session.participant_id !== "string" ||
          typeof session.study_id !== "string" ||
          typeof session.prompt_id !== "string" ||
          typeof session.activity_id !== "string"
        ) {
          return null;
        }

        return {
          session_uuid: session.session_uuid,
          participant_id: session.participant_id,
          study_id: session.study_id,
          prompt_id: session.prompt_id,
          protocol_version:
            typeof session.protocol_version === "number"
              ? session.protocol_version
              : null,
          activity_id: session.activity_id,
          activity_version:
            typeof session.activity_version === "string"
              ? session.activity_version
              : null,
          started_at: parseDate(session.started_at) ?? null,
          ended_at: parseDate(session.ended_at) ?? null,
          canceled:
            typeof session.canceled === "boolean" ? session.canceled : null,
          trials_json: Array.isArray(session.trials)
            ? (session.trials as Prisma.InputJsonValue)
            : [],
          scoring_json: Array.isArray(session.scoring)
            ? (session.scoring as Prisma.InputJsonValue)
            : [],
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null),
    skipDuplicates: true,
  });

  await prisma.promptLog.createMany({
    data: state.promptLogs
      .map((row) => {
        const promptLog = row as Record<string, unknown>;
        if (
          typeof promptLog.prompt_id !== "string" ||
          typeof promptLog.participant_id !== "string"
        ) {
          return null;
        }

        return {
          prompt_id: promptLog.prompt_id,
          participant_id: promptLog.participant_id,
          study_id:
            typeof promptLog.study_id === "string" ? promptLog.study_id : null,
          protocol_version:
            typeof promptLog.protocol_version === "number"
              ? promptLog.protocol_version
              : null,
          session_uuid:
            typeof promptLog.session_uuid === "string"
              ? promptLog.session_uuid
              : null,
          scheduled_for: parseDate(promptLog.scheduled_for) ?? null,
          sent_at: parseDate(promptLog.sent_at) ?? null,
          opened_at: parseDate(promptLog.opened_at) ?? null,
          assessment_started_at:
            parseDate(promptLog.assessment_started_at) ?? null,
          assessment_ended_at: parseDate(promptLog.assessment_ended_at) ?? null,
          status:
            typeof promptLog.status === "string" ? promptLog.status : null,
          quit_early:
            promptLog.status === "quit_early" || promptLog.quit_early === true,
          n_trials_completed:
            typeof promptLog.n_trials_completed === "number"
              ? promptLog.n_trials_completed
              : null,
          context_snapshot_id:
            typeof promptLog.context_snapshot_id === "string"
              ? promptLog.context_snapshot_id
              : null,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null),
    skipDuplicates: true,
  });

  await prisma.contextSnapshot.createMany({
    data: state.contextSnapshots
      .map((row) => {
        const snapshot = row as Record<string, unknown>;
        if (
          typeof snapshot.snapshot_id !== "string" ||
          typeof snapshot.participant_id !== "string"
        ) {
          return null;
        }

        return {
          snapshot_id: snapshot.snapshot_id,
          prompt_id:
            typeof snapshot.prompt_id === "string" ? snapshot.prompt_id : null,
          participant_id: snapshot.participant_id,
          study_id:
            typeof snapshot.study_id === "string" ? snapshot.study_id : null,
          protocol_version:
            typeof snapshot.protocol_version === "number"
              ? snapshot.protocol_version
              : null,
          captured_at: parseDate(snapshot.captured_at) ?? null,
          latitude:
            typeof snapshot.latitude === "number" ? snapshot.latitude : null,
          longitude:
            typeof snapshot.longitude === "number" ? snapshot.longitude : null,
          gps_accuracy_meters:
            typeof snapshot.gps_accuracy_meters === "number"
              ? snapshot.gps_accuracy_meters
              : null,
          battery_level:
            typeof snapshot.battery_level === "number"
              ? snapshot.battery_level
              : null,
          is_charging:
            typeof snapshot.is_charging === "boolean"
              ? snapshot.is_charging
              : null,
          network_type:
            typeof snapshot.network_type === "string"
              ? snapshot.network_type
              : null,
          payload_json:
            snapshot.payload_json !== undefined
              ? (snapshot.payload_json as Prisma.InputJsonValue)
              : Prisma.JsonNull,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null),
    skipDuplicates: true,
  });

  await prisma.surveyItemResponse.createMany({
    data: state.surveyResponses
      .map((row) => {
        const response = row as Record<string, unknown>;
        if (
          typeof response.record_id !== "string" ||
          typeof response.participant_id !== "string" ||
          typeof response.survey_id !== "string" ||
          typeof response.item_id !== "string" ||
          typeof response.response_status !== "string"
        ) {
          return null;
        }

        return {
          record_id: response.record_id,
          session_uuid:
            typeof response.session_uuid === "string"
              ? response.session_uuid
              : null,
          prompt_id:
            typeof response.prompt_id === "string" ? response.prompt_id : null,
          participant_id: response.participant_id,
          study_id:
            typeof response.study_id === "string" ? response.study_id : null,
          protocol_version:
            typeof response.protocol_version === "number"
              ? response.protocol_version
              : null,
          survey_id: response.survey_id,
          survey_version:
            typeof response.survey_version === "number"
              ? response.survey_version
              : null,
          item_id: response.item_id,
          response_status: response.response_status,
          response_value:
            response.response_value !== undefined
              ? (response.response_value as Prisma.InputJsonValue)
              : Prisma.JsonNull,
          captured_at: parseDate(response.captured_at) ?? null,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null),
    skipDuplicates: true,
  });

  await prisma.exportJob.createMany({
    data: state.exportJobs
      .map((row) => {
        const job = row as Record<string, unknown>;
        if (
          typeof job.job_id !== "string" ||
          typeof job.study_id !== "string" ||
          typeof job.format !== "string" ||
          typeof job.status !== "string"
        ) {
          return null;
        }

        return {
          job_id: job.job_id,
          study_id: job.study_id,
          format: job.format,
          status: job.status,
          download_url:
            typeof job.download_url === "string" ? job.download_url : null,
          error: typeof job.error === "string" ? job.error : null,
          created_at: parseDate(job.created_at) ?? new Date(),
          updated_at: parseDate(job.updated_at) ?? new Date(),
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null),
    skipDuplicates: true,
  });

  console.log(
    `[ema-server] imported file-backed state into Postgres: studies=${studyIds.size}, participants=${state.participants.length}, protocols=${state.studyProtocols.length}`,
  );
}

main()
  .catch((error) => {
    console.error("[ema-server] import-state failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
