# EMA Server Scaffold

Minimal backend scaffold for the EMA app, with file-backed prototype persistence and an optional Prisma/Postgres slice.

## Run

```bash
cd ema-app/server
npm run build
npm start
```

Default server URL:

- `http://localhost:3000/v1`

Default credentials:

- API key header: `X-Api-Key: ema-dev-api-key`
- participant JWTs are returned by `POST /v1/participants`

## Storage Modes

- default prototype mode:
  - uploads and local prototype state persist to `ema-app/server/data/state.json`
- optional database mode:
  - set `DATABASE_URL`
  - run Prisma generate/migrate
  - studies, protocol versions, participants, and export jobs are stored in Postgres
  - uploads still use the JSON-backed prototype store for now

## Included Routes

- `GET /v1/health`
- `POST /v1/participants`
- `GET /v1/participants`
- `GET /v1/participants/:participant_id/protocol`
- `GET /v1/studies/:study_id/protocol`
- `PUT /v1/studies/:study_id/protocol`
- `POST /v1/sessions`
- `POST /v1/prompt-logs`
- `POST /v1/context-snapshots`
- `POST /v1/survey-responses`
- `GET /v1/participants/:participant_id/sync-status`
- `GET /v1/participants/:participant_id/compliance`
- `POST /v1/studies/:study_id/export`
- `GET /v1/export-jobs/:job_id`

This scaffold is intentionally temporary:

- uploads remain JSON-file-backed at `ema-app/server/data/state.json`
- only the first persistence slice is database-backed so far
- auth is minimal
- export jobs are placeholders
- no production hardening is included yet
