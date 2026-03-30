import Dexie from "dexie";
/**
 * Extended IndexedDB database for EMA.
 * Adds promptLog, contextSnapshots, and syncQueue tables on top of the
 * m2c2kit/db activityResults and keyValueStore tables.
 */
export class EmaDatabase extends Dexie {
  constructor() {
    super("m2c2db");
    this.version(1).stores({
      // m2c2kit/db tables (kept for compatibility)
      activityResults: "document_uuid, timestamp, activity_publish_uuid",
      keyValueStore: "key, timestamp",
      // EMA-specific tables
      promptLog: "prompt_id, status, scheduled_for, session_uuid",
      contextSnapshots: "snapshot_id, prompt_id, captured_at",
      surveyResponses: "record_id, prompt_id, session_uuid, survey_id, item_id",
      syncQueue: "++id, table_name, status, created_at",
    });
  }
  /** Save a record and immediately enqueue it for sync. Atomic. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async saveAndEnqueue(table, record, pkField) {
    await this.transaction("rw", [table, this.syncQueue], async () => {
      await table.put(record);
      await this.syncQueue.add({
        table_name: table.name,
        record_id: record[pkField],
        status: "pending",
        attempt_count: 0,
        last_attempted_at: null,
        error: null,
        created_at: new Date().toISOString(),
      });
    });
  }
  async savePromptLog(entry) {
    await this.saveAndEnqueue(this.promptLog, entry, "prompt_id");
  }
  async saveContextSnapshot(snapshot) {
    await this.saveAndEnqueue(this.contextSnapshots, snapshot, "snapshot_id");
  }
  async saveSurveyResponses(responses) {
    if (responses.length === 0) {
      return;
    }
    await this.transaction(
      "rw",
      [this.surveyResponses, this.syncQueue],
      async () => {
        for (const response of responses) {
          await this.surveyResponses.put(response);
          await this.syncQueue.add({
            table_name: "surveyResponses",
            record_id: response.record_id,
            status: "pending",
            attempt_count: 0,
            last_attempted_at: null,
            error: null,
            created_at: new Date().toISOString(),
          });
        }
      },
    );
  }
  async getPendingSync(tableName) {
    return this.syncQueue
      .where({ table_name: tableName, status: "pending" })
      .toArray();
  }
  async getRetryableSync(tableName) {
    const [pending, failed] = await Promise.all([
      this.syncQueue
        .where({ table_name: tableName, status: "pending" })
        .toArray(),
      this.syncQueue
        .where({ table_name: tableName, status: "failed" })
        .toArray(),
    ]);
    return [...pending, ...failed].sort((a, b) =>
      a.created_at.localeCompare(b.created_at),
    );
  }
}
