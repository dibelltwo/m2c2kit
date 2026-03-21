/**
 * API client — implements the OpenAPI contract (api.openapi.yaml).
 * Used by SyncManager to upload data to the backend.
 */
export class ApiClient {
  constructor(baseUrl, token) {
    this.baseUrl = baseUrl;
    this.token = token;
  }
  async post(path, body) {
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
    return res.json();
  }
  async get(path) {
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${this.token}` },
    });
    if (!res.ok) {
      throw new Error(`GET ${path} failed: ${res.status}`);
    }
    return res.json();
  }
  async uploadSession(session) {
    return this.post("/sessions", session);
  }
  async uploadPromptLogs(entries) {
    return this.post("/prompt-logs", { entries });
  }
  async uploadContextSnapshots(snapshots) {
    return this.post("/context-snapshots", { snapshots });
  }
  async uploadSurveyResponses(responses) {
    return this.post("/survey-responses", { responses });
  }
  async getSyncStatus(participantId) {
    return this.get(`/participants/${participantId}/sync-status`);
  }
}
