# Database Transition Notes

Current backend runtime:

- file-backed uploads and prototype state in `../data/state.json`
- optional Postgres persistence via Prisma for studies, protocol versions, participants, and export jobs

Next backend target:

- PostgreSQL via Prisma

Scaffolded files:

- `../../prisma/schema.prisma`
- `./prisma.ts`
- `../../docker-compose.yml`
- `../../.env.example`

Suggested next migration order:

1. install Prisma dependencies
2. start Postgres locally
3. run Prisma migrate/generate
4. move `Study` and `Participant` reads/writes to Prisma
5. move `StudyProtocolVersion` and `ExportJob`
6. move uploads, sync state, and compliance aggregation
