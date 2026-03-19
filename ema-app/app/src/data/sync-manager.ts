import { Network, type ConnectionStatus } from "@capacitor/network";
import type { EmaDatabase, SyncQueueItem } from "./ema-database";
import type { ApiClient } from "./api-client";
import type { PromptLogEntry } from "../../../contracts/prompt-log.schema";
import type { ContextSnapshot } from "../../../contracts/context-snapshot.schema";

const BATCH_SIZE = 50;
const MAX_ATTEMPTS = 5;

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size)
    chunks.push(arr.slice(i, i + size));
  return chunks;
}

/**
 * Orchestrates uploading all pending data to the backend.
 * Triggered by: network recovery, session end, app foreground, background runner.
 */
export class SyncManager {
  private syncing = false;
  private lastSyncAt = 0;

  constructor(
    private db: EmaDatabase,
    private api: ApiClient,
  ) {
    // Auto-sync when network becomes available
    Network.addListener("networkStatusChange", (status: ConnectionStatus) => {
      if (status.connected) {
        console.log("[Sync] Network available — triggering sync");
        void this.sync();
      }
    });
  }

  /** Full sync — uploads all pending queue items. */
  async sync(): Promise<void> {
    if (this.syncing) return;
    this.syncing = true;
    try {
      await this.syncPromptLogs();
      await this.syncContextSnapshots();
      // activityResults sync handled separately (needs session assembly)
      this.lastSyncAt = Date.now();
      console.log("[Sync] Sync complete");
    } catch (err) {
      console.error("[Sync] Sync failed:", err);
    } finally {
      this.syncing = false;
    }
  }

  /** Sync only if last sync was more than intervalMs ago. */
  async syncIfStale(intervalMs = 60 * 60 * 1000): Promise<void> {
    if (Date.now() - this.lastSyncAt > intervalMs) {
      await this.sync();
    }
  }

  private async syncPromptLogs(): Promise<void> {
    const pending = await this.db.getPendingSync("promptLog");
    if (pending.length === 0) return;

    for (const batch of chunk(pending, BATCH_SIZE)) {
      const ids = batch.map((q) => q.record_id);
      const rows = await this.db.promptLog
        .where("prompt_id")
        .anyOf(ids)
        .toArray();

      await this.uploadBatch(batch, async () => {
        const result = await this.api.uploadPromptLogs(
          rows as PromptLogEntry[],
        );
        return ids.slice(0, result.upserted);
      });
    }
  }

  private async syncContextSnapshots(): Promise<void> {
    const pending = await this.db.getPendingSync("contextSnapshots");
    if (pending.length === 0) return;

    for (const batch of chunk(pending, BATCH_SIZE)) {
      const ids = batch.map((q) => q.record_id);
      const rows = await this.db.contextSnapshots
        .where("snapshot_id")
        .anyOf(ids)
        .toArray();

      await this.uploadBatch(batch, async () => {
        const result = await this.api.uploadContextSnapshots(
          rows as ContextSnapshot[],
        );
        return ids.slice(0, result.stored);
      });
    }
  }

  private async uploadBatch(
    batch: SyncQueueItem[],
    uploadFn: () => Promise<string[]>,
  ): Promise<void> {
    const ids = batch.map((b) => b.id!);

    // Skip items that have exceeded max attempts
    const eligible = batch.filter((b) => b.attempt_count < MAX_ATTEMPTS);
    if (eligible.length === 0) return;

    await this.db.syncQueue
      .where("id")
      .anyOf(ids)
      .modify({ status: "uploading" });

    try {
      const uploadedIds = await uploadFn();
      await this.db.syncQueue
        .where("record_id")
        .anyOf(uploadedIds)
        .modify({ status: "done" });
    } catch (err) {
      await this.db.syncQueue
        .where("id")
        .anyOf(ids)
        .modify((item) => {
          item.status = "failed";
          item.attempt_count += 1;
          item.last_attempted_at = new Date().toISOString();
          item.error = String(err);
          // Reset to pending so next sync will retry (up to MAX_ATTEMPTS)
          if (item.attempt_count < MAX_ATTEMPTS) {
            item.status = "pending";
          }
        });
    }
  }
}
