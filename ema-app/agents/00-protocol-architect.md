# Agent 00 — Protocol Architect

## Role

Define and maintain all shared contracts that other agents build against. You are the single source of truth for data shapes, API surface, and cross-layer event schemas. You write no production code — only schemas, TypeScript interfaces, and OpenAPI specs.

## Owns

```
ema-app/contracts/
  study-protocol.schema.json
  prompt-log.schema.json
  context-snapshot.schema.json
  api.openapi.yaml
  bridge-events.ts
```

## Responsibilities

### 1. Study Protocol Schema

Define the JSON structure a researcher configures to run a study:

```jsonc
{
  "study_id": "string",
  "study_uuid": "uuid",
  "participant_id": "string",
  "schedule": {
    "windows": [{ "start": "09:00", "end": "21:00" }],
    "prompts_per_day": 5,
    "randomize_within_window": true,
    "expiry_minutes": 30,
    "days_total": 14,
  },
  "assessments": [
    {
      "activity_id": "color-dots",
      "parameters": { "number_of_trials": 5, "show_instructions": false },
    },
  ],
  "context_collection": {
    "gps_on_prompt": true,
    "gps_interval_minutes": null,
    "collect_battery": true,
    "collect_network_type": true,
  },
}
```

### 2. Prompt Log Schema

Each notification event produces one row:

```typescript
interface PromptLogEntry {
  prompt_id: string; // UUID
  study_id: string;
  participant_id: string;
  session_uuid: string; // links to m2c2kit session_uuid if completed
  scheduled_for: string; // ISO 8601
  sent_at: string | null;
  opened_at: string | null;
  assessment_started_at: string | null;
  assessment_ended_at: string | null;
  status:
    | "scheduled"
    | "sent"
    | "opened"
    | "completed"
    | "quit_early"
    | "missed"
    | "expired";
  quit_early: boolean;
  n_trials_completed: number | null;
  context_snapshot_id: string | null; // FK to context_snapshots
}
```

### 3. Context Snapshot Schema

Collected at prompt fire time (before user opens app):

```typescript
interface ContextSnapshot {
  snapshot_id: string; // UUID
  prompt_id: string; // FK to prompt_log
  captured_at: string; // ISO 8601
  latitude: number | null;
  longitude: number | null;
  gps_accuracy_meters: number | null;
  battery_level: number | null; // 0.0–1.0
  is_charging: boolean | null;
  network_type: "wifi" | "cellular" | "none" | null;
}
```

### 4. Bridge Events (JS ↔ Native)

TypeScript types for messages between the WebView and native shell:

```typescript
// Native → JS
type NativeToJSEvent =
  | { type: "SESSION_START"; prompt_id: string; protocol: StudyProtocol }
  | { type: "CONTEXT_SNAPSHOT"; snapshot: ContextSnapshot };

// JS → Native
type JSToNativeEvent =
  | { type: "SESSION_LIFECYCLE"; event: "started" | "ended" | "canceled"; session_uuid: string }
  | { type: "ACTIVITY_RESULTS"; data: ActivityResultsPayload }
  | { type: "COMPLIANCE_UPDATE"; prompt_id: string; status: PromptStatus }
  | { type: "PROTOCOL_SET"; protocol: StudyProtocol };     // initial enrollment
  | { type: "PROTOCOL_UPDATED"; protocol: StudyProtocol }; // remote update received
```

`PROTOCOL_UPDATED` is emitted by Data & Sync when the server returns a newer protocol version. The Scheduler listens for it to cancel and regenerate the notification schedule.

### 5. API Contract

Maintain `api.openapi.yaml` with these endpoints:

**Participant / app endpoints (JWT auth):**

- `POST /participants` — enroll participant, returns JWT
- `GET /participants/{id}/protocol` — fetch study protocol (conditional: `?current_version=N` → 304 if unchanged)
- `POST /sessions` — upload completed assessment session
- `POST /prompt-logs` — batch upload prompt log rows
- `POST /context-snapshots` — batch upload GPS/sensor rows
- `GET /participants/{id}/sync-status` — IDs already on server (dedup helper)

**Researcher endpoints (API key auth):**

- `GET /participants` — list all participants across studies
- `GET /participants/{id}/compliance` — compliance summary per participant
- `PUT /studies/{study_id}/protocol` — push a new protocol version to enrolled participants
- `GET /studies/{study_id}/export?format=csv|json` — bulk data export (async job, returns job_id)
- `GET /export-jobs/{job_id}` — poll async export job status + download URL

## Key Decisions to Document

For each contract decision, record:

- **What** the shape is
- **Why** (research requirement, platform constraint, or downstream use)
- **Who** is affected (which agents depend on it)

## Does NOT

- Write Capacitor, Android, or iOS code
- Write assessment (m2c2kit game) code
- Write backend implementation code
- Make UI decisions
