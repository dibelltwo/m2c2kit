import type { StudyProtocol } from "../../../contracts/study-protocol.schema";

declare global {
  interface Window {
    __DASHBOARD_API_BASE__?: string;
    __DASHBOARD_API_KEY__?: string;
  }
}

export interface ParticipantSummary {
  participant_id: string;
  study_id: string;
  enrolled_at: string;
  last_sync_at?: string | null;
  protocol_version?: number | null;
}

export interface ComplianceSummary {
  participant_id: string;
  response_rate: number;
  completion_rate: number;
  missed_prompts: number;
  completed_prompts: number;
  last_prompt_at: string | null;
}

export interface ExportJob {
  job_id: string;
  status: "pending" | "running" | "ready" | "failed";
  download_url?: string;
  error?: string;
}

export interface ProtocolVersionSummary {
  version: number;
  updated_at: string;
}

export interface BackendHealth {
  ok: boolean;
  service: string;
  timestamp: string;
  storage_mode?: "database" | "file";
  counts?: {
    participants: number;
    protocol_versions: number;
    sessions: number;
    prompt_logs: number;
    context_snapshots: number;
    survey_responses: number;
    export_jobs: number;
  };
}

const API_BASE = window.__DASHBOARD_API_BASE__ ?? "http://localhost:3000/v1";
const API_KEY = window.__DASHBOARD_API_KEY__ ?? "";
const DEMO_MODE = API_KEY.trim().length === 0;

const demoParticipants: ParticipantSummary[] = [
  {
    participant_id: "P-014",
    study_id: "dev-study",
    enrolled_at: "2026-03-16T09:15:00Z",
    last_sync_at: "2026-03-20T18:05:00Z",
    protocol_version: 4,
  },
  {
    participant_id: "P-021",
    study_id: "dev-study",
    enrolled_at: "2026-03-17T08:10:00Z",
    last_sync_at: "2026-03-20T17:42:00Z",
    protocol_version: 4,
  },
];

const demoCompliance: Record<string, ComplianceSummary> = {
  "P-014": {
    participant_id: "P-014",
    response_rate: 0.83,
    completion_rate: 0.78,
    missed_prompts: 3,
    completed_prompts: 14,
    last_prompt_at: "2026-03-20T17:30:00Z",
  },
  "P-021": {
    participant_id: "P-021",
    response_rate: 0.74,
    completion_rate: 0.7,
    missed_prompts: 5,
    completed_prompts: 11,
    last_prompt_at: "2026-03-20T16:50:00Z",
  },
};

async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(API_KEY ? { "X-Api-Key": API_KEY } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${path}`);
  }

  return response.json() as Promise<T>;
}

export const dashboardApi = {
  isDemoMode(): boolean {
    return DEMO_MODE;
  },

  async listParticipants(studyId?: string): Promise<ParticipantSummary[]> {
    if (DEMO_MODE) {
      return demoParticipants.filter((entry) =>
        studyId ? entry.study_id === studyId : true,
      );
    }
    return apiRequest<ParticipantSummary[]>(
      `/participants${studyId ? `?study_id=${encodeURIComponent(studyId)}` : ""}`,
    );
  },

  async getHealth(): Promise<BackendHealth> {
    if (DEMO_MODE) {
      return {
        ok: true,
        service: "ema-server-demo",
        timestamp: "2026-03-22T12:00:00Z",
        storage_mode: "file",
        counts: {
          participants: 2,
          protocol_versions: 4,
          sessions: 12,
          prompt_logs: 24,
          context_snapshots: 3,
          survey_responses: 40,
          export_jobs: 1,
        },
      };
    }
    return apiRequest<BackendHealth>("/health");
  },

  async getCompliance(participantId: string): Promise<ComplianceSummary> {
    if (DEMO_MODE) {
      return (
        demoCompliance[participantId] ?? {
          participant_id: participantId,
          response_rate: 0,
          completion_rate: 0,
          missed_prompts: 0,
          completed_prompts: 0,
          last_prompt_at: null,
        }
      );
    }
    return apiRequest<ComplianceSummary>(
      `/participants/${participantId}/compliance`,
    );
  },

  async getProtocol(studyId: string): Promise<StudyProtocol> {
    if (DEMO_MODE) {
      const module = await import("../../app/src/setup/default-protocol");
      return module.createDefaultProtocol();
    }
    return apiRequest<StudyProtocol>(`/studies/${studyId}/protocol`);
  },

  async pushProtocol(
    studyId: string,
    protocol: StudyProtocol,
  ): Promise<{ version: number }> {
    if (DEMO_MODE) {
      return { version: protocol.version };
    }
    return apiRequest<{ version: number }>(`/studies/${studyId}/protocol`, {
      method: "PUT",
      body: JSON.stringify(protocol),
    });
  },

  async listProtocolVersions(
    studyId: string,
  ): Promise<ProtocolVersionSummary[]> {
    if (DEMO_MODE) {
      return [{ version: 4, updated_at: "2026-03-20T17:00:00Z" }];
    }
    const response = await apiRequest<{
      study_id: string;
      versions: ProtocolVersionSummary[];
    }>(`/studies/${studyId}/protocol-versions`);
    return response.versions;
  },

  async startExport(
    studyId: string,
    format: "csv" | "json",
  ): Promise<{ job_id: string }> {
    if (DEMO_MODE) {
      return { job_id: `demo-export-${studyId}-${format}` };
    }
    return apiRequest<{ job_id: string }>(`/studies/${studyId}/export`, {
      method: "POST",
      body: JSON.stringify({ format }),
    });
  },

  async pollExportJob(jobId: string): Promise<ExportJob> {
    if (DEMO_MODE) {
      return {
        job_id: jobId,
        status: "ready",
        download_url: "#demo-download",
      };
    }
    return apiRequest<ExportJob>(`/export-jobs/${jobId}`);
  },
};
