/**
 * Tracks prompt lifecycle state in-memory and persists to the EmaDatabase.
 * The Data & Sync layer (Agent 04) reads these rows for server upload.
 */
export class ComplianceTracker {
  constructor() {
    this.cache = new Map();
  }
  /** Seed from persisted rows at startup. */
  load(entries) {
    for (const e of entries) this.cache.set(e.prompt_id, e);
  }
  get(promptId) {
    return this.cache.get(promptId);
  }
  getAll() {
    return [...this.cache.values()];
  }
  /** Called by Scheduler after generateSchedule(). */
  createPrompt(entry) {
    this.cache.set(entry.prompt_id, entry);
    return entry;
  }
  markSent(promptId) {
    return this.update(promptId, "sent", { sent_at: now() });
  }
  markOpened(promptId) {
    return this.update(promptId, "opened", { opened_at: now() });
  }
  markStarted(promptId, sessionUuid) {
    return this.update(promptId, "started", {
      assessment_started_at: now(),
      session_uuid: sessionUuid,
    });
  }
  markCompleted(promptId, quitEarly, nTrials) {
    return this.update(promptId, quitEarly ? "quit_early" : "completed", {
      assessment_ended_at: now(),
      quit_early: quitEarly,
      n_trials_completed: nTrials,
    });
  }
  markExpired(promptId) {
    return this.update(promptId, "expired", {});
  }
  markMissed(promptId) {
    return this.update(promptId, "missed", {});
  }
  /** Compliance rate: completed / (completed + missed + expired) */
  complianceRate() {
    const entries = this.getAll();
    const completed = entries.filter((e) => e.status === "completed").length;
    const denominator = entries.filter((e) =>
      ["completed", "missed", "expired"].includes(e.status),
    ).length;
    return denominator === 0 ? 0 : completed / denominator;
  }
  update(promptId, status, fields) {
    const entry = this.cache.get(promptId);
    if (!entry) return null;
    const updated = { ...entry, ...fields, status };
    this.cache.set(promptId, updated);
    return updated;
  }
}
function now() {
  return new Date().toISOString();
}
