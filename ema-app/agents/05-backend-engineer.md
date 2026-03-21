# Agent 05 — Backend Engineer

## Role

Build and maintain the server-side API, database, and participant management system. You implement the `api.openapi.yaml` contract defined by the Protocol Architect. The app must function fully offline — the backend is for data archival and researcher access, not for real-time app operation.

## Owns

```
ema-app/server/
  src/
    routes/             ← Express/Fastify route handlers
    db/                 ← Prisma schema + migrations
    middleware/         ← auth, rate limiting, validation
    jobs/               ← data export, compliance reports
  prisma/
    schema.prisma
    migrations/
  Dockerfile
  docker-compose.yml    ← postgres + api
```

## Tech Stack (recommended, adaptable)

- **Runtime:** Node.js (TypeScript, Fastify)
- **Database:** PostgreSQL via Prisma ORM
- **Auth:** JWT (participant tokens) + API key (researcher dashboard)
- **Validation:** Zod (mirrors JSON schemas from contracts/)

## Database Schema (Prisma)

```prisma
model Participant {
  id              String   @id @default(uuid())
  study_id        String
  participant_id  String   @unique
  enrolled_at     DateTime @default(now())
  protocol        Json     // StudyProtocol snapshot at enrollment
  active          Boolean  @default(true)

  promptLogs       PromptLog[]
  assessmentResults AssessmentResult[]
  contextSnapshots  ContextSnapshot[]
  surveyResponses   SurveyItemResponse[]
}

model PromptLog {
  prompt_id               String      @id
  participant_id          String
  protocol_version        Int?
  session_uuid            String?
  scheduled_for           DateTime
  sent_at                 DateTime?
  opened_at               DateTime?
  assessment_started_at   DateTime?
  assessment_ended_at     DateTime?
  status                  PromptStatus
  quit_early              Boolean     @default(false)
  n_trials_completed      Int?
  context_snapshot_id     String?
  uploaded_at             DateTime    @default(now())

  participant   Participant @relation(fields: [participant_id], references: [participant_id])
}

model AssessmentResult {
  document_uuid           String   @id
  participant_id          String
  session_uuid            String
  activity_id             String
  activity_version        String
  timestamp               BigInt
  data_type               String   // "trial" or "scoring"
  data                    Json
  uploaded_at             DateTime @default(now())

  participant   Participant @relation(fields: [participant_id], references: [participant_id])

  @@index([session_uuid])
  @@index([activity_id])
  @@index([participant_id, timestamp])
}

model ContextSnapshot {
  snapshot_id         String   @id
  prompt_id           String
  participant_id      String
  protocol_version    Int?
  captured_at         DateTime
  latitude            Float?
  longitude           Float?
  gps_accuracy_meters Float?
  battery_level       Float?
  is_charging         Boolean?
  network_type        String?
  uploaded_at         DateTime @default(now())

  participant   Participant @relation(fields: [participant_id], references: [participant_id])
}

model SurveyItemResponse {
  record_id        String   @id
  session_uuid     String
  prompt_id        String?
  participant_id   String?
  study_id         String?
  protocol_version Int?
  survey_id        String
  survey_version   Int?
  item_id          String
  response_status  String   // "answered" | "skipped"
  response_value   Json?
  captured_at      DateTime
  uploaded_at      DateTime @default(now())

  participant   Participant? @relation(fields: [participant_id], references: [participant_id])

  @@index([session_uuid])
  @@index([prompt_id])
  @@index([survey_id, survey_version])
}

enum PromptStatus {
  scheduled
  sent
  opened
  completed
  quit_early
  missed
  expired
}
```

## API Routes

Implement exactly what `api.openapi.yaml` specifies:

### Enrollment

```
POST /participants
Body: { study_id, participant_id, protocol: StudyProtocol }
Response: { participant_id, token }  ← JWT for subsequent calls
```

### Protocol fetch (conditional — supports 304)

```
GET /participants/:id/protocol?current_version=N
Auth: Bearer token
Response: StudyProtocol (200) or 304 Not Modified
```

### Protocol update (researcher endpoint)

```
PUT /studies/:study_id/protocol
Auth: API key
Body: StudyProtocol (version must be > current stored version)
Response: { version: number }
```

Increment `version` on each write. The app polls with `?current_version=N` and receives 304 until this endpoint is called with a higher version.

### Batch sync endpoints (idempotent — upsert by PK)

```
POST /sessions
Body: SessionUpload
Response: { session_uuid, duplicate: boolean }

POST /prompt-logs
Body: { entries: PromptLogEntry[] }
Response: { upserted: number }

POST /context-snapshots
Body: { snapshots: ContextSnapshot[] }
Response: { stored: number }

POST /survey-responses
Body: { responses: SurveyItemResponse[] }
Response: { stored: number }

GET /participants/:id/sync-status?since=<datetime>
Auth: Bearer token
Response: { session_uuids, prompt_ids, snapshot_ids, survey_response_ids }
```

**Critical:** All sync endpoints must be **idempotent** — re-uploading the same `document_uuid` / `prompt_id` / `snapshot_id` must return 200, not 409. Use `INSERT ... ON CONFLICT DO NOTHING`:

```typescript
// Prisma upsert pattern
await prisma.assessmentResult.upsert({
  where: { document_uuid: row.document_uuid },
  update: {}, // no updates — first write wins
  create: { ...row, participant_id, uploaded_at: new Date() },
});
```

### Researcher endpoints (API key auth)

```
GET /participants
Auth: API key
Query: ?study_id=<id>   (optional filter)
Response: Participant[]
```

```
GET /participants/:id/compliance
Auth: API key
Response: {
  participant_id,
  study_id,
  total_prompts_scheduled,
  total_sent,
  total_completed,
  total_quit_early,
  total_missed,
  total_expired,
  response_rate,
  completion_rate,
  mean_response_latency_ms,
}
```

```
POST /studies/:study_id/export
Auth: API key
Body: { format: "csv" | "json" }
Response: { job_id: string }   ← async — do not block on large exports

GET /export-jobs/:job_id
Auth: API key
Response: { status: "pending"|"running"|"ready"|"failed", download_url?: string }
```

**Export is async.** The dashboard POSTs to start a job, polls `GET /export-jobs/:id` until `status: "ready"`, then downloads the zip. This prevents timeouts on large studies. Store job state in a `ExportJob` Prisma model; run the actual export in a background worker (simple `setImmediate` loop or BullMQ if load warrants it).

**Export flattening rules**

- Survey exports must union all `item_id`s across every `survey_version` in the study.
- If an item did not exist yet for an older session, export an empty value for that row and column.
- If a participant skipped an item, preserve `response_status = "skipped"` and export a null/empty response value.
- Every uploaded record should carry `protocol_version` so the exporter can group data by protocol revision without inference.

## Auth Strategy

- **Participant JWT:** issued at enrollment, long-lived (study duration), scoped to `participant_id` only
- **Researcher API key:** static key in env vars, used for export and compliance endpoints
- Never expose one participant's data to another

```typescript
// Middleware
async function participantAuth(req, reply) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  if (payload.participant_id !== req.params.id) throw new Error("Forbidden");
  req.participant = payload;
}
```

## Deployment (minimal)

```yaml
# docker-compose.yml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_DB: ema
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data

  api:
    build: .
    ports: ["3000:3000"]
    environment:
      DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD}@db:5432/ema
      JWT_SECRET: ${JWT_SECRET}
      API_KEY: ${API_KEY}
    depends_on: [db]
```

## Does NOT

- Write mobile app code
- Schedule notifications
- Implement the sync queue (that's Data & Sync agent)
- Render any UI (the dashboard UI is Agent 08)
- Store files/media (only JSON + scalar data)
- Push notifications to devices — protocol updates are pull-only (app polls)
