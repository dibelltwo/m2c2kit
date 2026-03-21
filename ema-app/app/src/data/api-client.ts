/**
 * API client — implements the OpenAPI contract (api.openapi.yaml).
 * Used by SyncManager to upload data to the backend.
 */

import type { PromptLogEntry } from "../../../contracts/prompt-log.schema";
import type { ContextSnapshot } from "../../../contracts/context-snapshot.schema";
import type { SurveyItemResponse } from "../../../contracts/survey-response.schema";

export interface SessionUpload {
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
}

export interface SyncStatus {
  session_uuids: string[];
  prompt_ids: string[];
  snapshot_ids: string[];
  survey_response_ids: string[];
}

export class ApiClient {
  constructor(
    private baseUrl: string,
    private token: string,
  ) {}

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`POST ${path} failed: ${res.status} ${text}`);
    }
    return res.json() as Promise<T>;
  }

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${this.token}` },
    });
    if (!res.ok) {
      throw new Error(`GET ${path} failed: ${res.status}`);
    }
    return res.json() as Promise<T>;
  }

  async uploadSession(
    session: SessionUpload,
  ): Promise<{ session_uuid: string; duplicate: boolean }> {
    return this.post("/sessions", session);
  }

  async uploadPromptLogs(
    entries: PromptLogEntry[],
  ): Promise<{ upserted: number }> {
    return this.post("/prompt-logs", { entries });
  }

  async uploadContextSnapshots(
    snapshots: ContextSnapshot[],
  ): Promise<{ stored: number }> {
    return this.post("/context-snapshots", { snapshots });
  }

  async uploadSurveyResponses(
    responses: SurveyItemResponse[],
  ): Promise<{ stored: number }> {
    return this.post("/survey-responses", { responses });
  }

  async getSyncStatus(participantId: string): Promise<SyncStatus> {
    return this.get(`/participants/${participantId}/sync-status`);
  }
}
