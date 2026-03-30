# Database Transition Notes

Current backend runtime:

- file-backed uploads and prototype state in `../data/state.json`
- optional Postgres persistence via Prisma for the full current backend slice:
  - studies
  - protocol versions
  - participants
  - export jobs
  - sessions
  - prompt logs
  - context snapshots
  - survey responses
  - sync-status/compliance reads

Next backend target:

- PostgreSQL via Prisma

Scaffolded files:

- `../../prisma/schema.prisma`
- `./prisma.ts`
- `../../docker-compose.yml`
- `../../.env.example`

Suggested next migration order:

1. start Postgres locally
2. copy `.env.example` to `.env`
3. run `npm run prisma:generate`
4. run `npm run prisma:migrate:deploy`
5. run `npm run build`
6. optionally run `npm run db:import-state`
