import Dexie, { type Table } from "dexie";
import type { PromptLogEntry } from "../../../contracts/prompt-log.schema";
import type { ContextSnapshot } from "../../../contracts/context-snapshot.schema";

export interface SyncQueueItem {
  id?: number;
  table_name: "activityResults" | "promptLog" | "contextSnapshots";
  record_id: string;
  status: "pending" | "uploading" | "done" | "failed";
  attempt_count: number;
  last_attempted_at: string | null;
  error: string | null;
  created_at: string;
}

/**
 * Extended IndexedDB database for EMA.
 * Adds promptLog, contextSnapshots, and syncQueue tables on top of the
 * m2c2kit/db activityResults and keyValueStore tables.
 */
export class EmaDatabase extends Dexie {
  promptLog!: Table<PromptLogEntry, string>;
  contextSnapshots!: Table<ContextSnapshot, string>;
  syncQueue!: Table<SyncQueueItem, number>;

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async saveAndEnqueue(
    table: Table<any, string>,
    record: Record<string, unknown>,
    pkField: string,
  ): Promise<void> {
    await this.transaction("rw", [table, this.syncQueue], async () => {
      await table.put(record);
      await this.syncQueue.add({
        table_name: table.name as SyncQueueItem["table_name"],
        record_id: record[pkField] as string,
        status: "pending",
        attempt_count: 0,
        last_attempted_at: null,
        error: null,
        created_at: new Date().toISOString(),
      });
    });
  }

  async savePromptLog(entry: PromptLogEntry): Promise<void> {
    await this.saveAndEnqueue(
      this.promptLog,
      entry as unknown as Record<string, unknown>,
      "prompt_id",
    );
  }

  async saveContextSnapshot(snapshot: ContextSnapshot): Promise<void> {
    await this.saveAndEnqueue(
      this.contextSnapshots,
      snapshot as unknown as Record<string, unknown>,
      "snapshot_id",
    );
  }

  async getPendingSync(
    tableName: SyncQueueItem["table_name"],
  ): Promise<SyncQueueItem[]> {
    return this.syncQueue
      .where({ table_name: tableName, status: "pending" })
      .toArray();
  }
}
