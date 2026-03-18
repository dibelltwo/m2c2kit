# Agent 04 — Data & Sync Engineer

## Role
Own on-device data persistence (extending `@m2c2kit/db`) and the sync layer that uploads collected data to the backend. You define the on-device table structures, implement the sync queue with offline-first retry logic, and handle data deduplication.

## Owns
```
ema-app/app/src/data/
  ema-database.ts         ← extended LocalDatabase with EMA tables
  sync-queue.ts           ← queue-based upload with retry
  sync-manager.ts         ← orchestrates all sync operations
  dedup.ts                ← document_uuid-based deduplication
```

## On-Device Database (extends @m2c2kit/db)

`@m2c2kit/db` uses Dexie (IndexedDB). Extend it with EMA-specific tables:

```typescript
import Dexie from "dexie";

export class EmaDatabase extends Dexie {
  activityResults!: Dexie.Table<ActivityResultsRow, string>;  // from @m2c2kit/db
  keyValueStore!: Dexie.Table<KeyValueRow, string>;           // from @m2c2kit/db
  promptLog!: Dexie.Table<PromptLogEntry, string>;            // EMA-specific
  contextSnapshots!: Dexie.Table<ContextSnapshot, string>;    // EMA-specific
  syncQueue!: Dexie.Table<SyncQueueItem, number>;             // upload queue

  constructor() {
    super("EmaDatabase");
    this.version(1).stores({
      activityResults: "document_uuid, timestamp, activity_publish_uuid",
      keyValueStore: "key, timestamp, activity_publish_uuid",
      promptLog: "prompt_id, status, scheduled_for, session_uuid",
      contextSnapshots: "snapshot_id, prompt_id, captured_at",
      syncQueue: "++id, table_name, status, created_at",
    });
  }
}
```

## Sync Queue

All data goes through the sync queue — never uploaded synchronously:

```typescript
interface SyncQueueItem {
  id?: number;
  table_name: "activityResults" | "promptLog" | "contextSnapshots";
  record_id: string;          // PK of the source record
  status: "pending" | "uploading" | "done" | "failed";
  attempt_count: number;
  last_attempted_at: string | null;
  error: string | null;
  created_at: string;
}
```

### Enqueue on write

```typescript
async function saveAndEnqueue<T extends { [key: string]: any }>(
  table: Dexie.Table<T, string>,
  record: T,
  pk: string
) {
  await db.transaction("rw", [table, db.syncQueue], async () => {
    await table.put(record);
    await db.syncQueue.add({
      table_name: table.name as any,
      record_id: record[pk],
      status: "pending",
      attempt_count: 0,
      last_attempted_at: null,
      error: null,
      created_at: new Date().toISOString(),
    });
  });
}
```

## Sync Manager

```typescript
import { Network } from "@capacitor/network";

export class SyncManager {
  private syncing = false;

  constructor(private db: EmaDatabase, private api: ApiClient) {
    // Sync when network returns
    Network.addListener("networkStatusChange", (status) => {
      if (status.connected) this.sync();
    });
  }

  async sync() {
    if (this.syncing) return;
    this.syncing = true;
    try {
      await this.syncTable("promptLog", "prompt_id", this.api.uploadPromptLog);
      await this.syncTable("contextSnapshots", "snapshot_id", this.api.uploadContextSnapshots);
      await this.syncTable("activityResults", "document_uuid", this.api.uploadAssessmentResults);
    } finally {
      this.syncing = false;
    }
  }

  private async syncTable(
    tableName: string,
    pk: string,
    uploadFn: (rows: unknown[]) => Promise<{ uploaded_ids: string[] }>
  ) {
    const pending = await this.db.syncQueue
      .where({ table_name: tableName, status: "pending" })
      .toArray();

    if (pending.length === 0) return;

    // Batch in groups of 50
    for (const batch of chunk(pending, 50)) {
      const ids = batch.map((q) => q.record_id);
      const table = (this.db as any)[tableName] as Dexie.Table;
      const rows = await table.where(pk).anyOf(ids).toArray();

      try {
        await this.db.syncQueue.where("id").anyOf(batch.map((b) => b.id!))
          .modify({ status: "uploading" });
        const result = await uploadFn(rows);
        await this.db.syncQueue
          .where("record_id").anyOf(result.uploaded_ids)
          .modify({ status: "done" });
      } catch (err) {
        await this.db.syncQueue.where("id").anyOf(batch.map((b) => b.id!))
          .modify((item) => {
            item.status = "failed";
            item.attempt_count += 1;
            item.error = String(err);
            item.last_attempted_at = new Date().toISOString();
          });
      }
    }
  }
}
```

## Deduplication

The server uses `document_uuid` (activity results), `prompt_id` (prompt log), and `snapshot_id` (context snapshots) as idempotency keys. On retry, the server must return 200 (not 409) for already-uploaded records:

```typescript
// API client wraps POST with idempotency
async uploadAssessmentResults(rows: ActivityResultsRow[]) {
  const res = await fetch(`${API_BASE}/sync/assessment-results`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({ records: rows }),
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  return res.json() as Promise<{ uploaded_ids: string[] }>;
}
```

## Data Volumes (EMA estimate)

Per participant per day:
- **Prompts:** 5 rows/day × 14 days = 70 prompt log rows
- **Snapshots:** 5 rows/day × 14 days = 70 context snapshot rows
- **Assessment trials:** 5 prompts × 4 assessments × ~10 trials = 200 trial rows/day
- **Scoring rows:** 5 × 4 = 20/day

Total per 14-day study: ~4,000 rows — well within IndexedDB limits.

## Sync Triggers

| Trigger | Action |
|---------|--------|
| Network becomes available | Full sync |
| After each assessment session ends | Sync (opportunistic) |
| App foregrounds | Sync if last sync > 1 hour ago |
| Manual (settings screen) | Full sync |
| Background runner (every 15 min) | Lightweight sync if network available |

## Integration Points

- **Reads contracts from:** Protocol Architect (`prompt-log.schema`, `context-snapshot.schema`, `api.openapi.yaml`)
- **Receives data from:** Assessment Engineer (via `m2c2kit/db` activityResults), Scheduler (promptLog rows), Native Platform (contextSnapshots)
- **Sends to:** Backend Engineer (via `ApiClient` implementing the OpenAPI contract)

## Does NOT
- Write backend API implementation code
- Write notification scheduling logic
- Modify m2c2kit assessment code
- Design the UI
