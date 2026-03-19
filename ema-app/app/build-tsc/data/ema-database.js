import Dexie from "dexie";
/**
 * Extended IndexedDB database for EMA.
 * Adds promptLog, contextSnapshots, and syncQueue tables on top of the
 * m2c2kit/db activityResults and keyValueStore tables.
 */
export class EmaDatabase extends Dexie {
  constructor() {
    super("EmaDatabase");
    this.version(1).stores({
      // m2c2kit/db tables (kept for compatibility)
      activityResults: "document_uuid, timestamp, activity_publish_uuid",
      keyValueStore: "key, timestamp",
      // EMA-specific tables
      promptLog: "prompt_id, status, scheduled_for, session_uuid",
      contextSnapshots: "snapshot_id, prompt_id, captured_at",
      syncQueue: "++id, table_name, status, created_at",
    });
  }
  /** Save a record and immediately enqueue it for sync. Atomic. */
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
  async getPendingSync(tableName) {
    return this.syncQueue
      .where({ table_name: tableName, status: "pending" })
      .toArray();
  }
}
