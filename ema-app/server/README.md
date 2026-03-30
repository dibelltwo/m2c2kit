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
  - create `.env` from `.env.example`
  - set `DATABASE_URL`
  - run `npm run prisma:generate`
  - run `npm run prisma:migrate:deploy`
  - optionally run `npm run db:import-state` after `npm run build` to move existing `data/state.json` records into Postgres
  - studies, protocol versions, participants, and export jobs are stored in Postgres
  - sessions, prompt logs, context snapshots, survey responses, sync-status, and compliance also switch to Postgres

## Local DB Validation Mode

If you do not have a system Postgres install, there is now a local validation path:

- `npm run db:pglite`
  - starts a temporary Postgres-compatible wire server backed by PGlite on port `5432`
- `DATABASE_URL='postgresql://postgres@localhost:5432/postgres' npm run prisma:migrate:deploy`
- `DATABASE_URL='postgresql://postgres@localhost:5432/postgres' npm run db:import-state`
- `DATABASE_URL='./data/pglite' PGLITE_DATA_DIR='./data/pglite' PORT=3300 node dist/index.js`
  - runs the EMA server in DB-backed mode using the same migrated/imported PGlite data directory

## Included Routes

- `GET /v1/health`
- `POST /v1/participants`
- `GET /v1/participants`
- `GET /v1/participants/:participant_id/protocol`
- `GET /v1/studies/:study_id/protocol`
- `GET /v1/studies/:study_id/protocol-versions`
- `PUT /v1/studies/:study_id/protocol`
- `POST /v1/sessions`
- `POST /v1/prompt-logs`
- `POST /v1/context-snapshots`
- `POST /v1/survey-responses`
- `GET /v1/participants/:participant_id/sync-status`
- `GET /v1/participants/:participant_id/compliance`
- `POST /v1/studies/:study_id/export`
- `GET /v1/export-jobs/:job_id`
- `GET /v1/exports/:job_id`

This scaffold is intentionally temporary:

- file mode still exists for fast local prototyping
- auth is minimal
- export jobs are placeholders
- no production hardening is included yet
