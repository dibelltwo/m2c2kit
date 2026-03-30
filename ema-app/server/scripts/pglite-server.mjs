import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { createServer } from "pglite-server";

const rootDir = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(rootDir, "../data/pglite");
const port = Number(process.env.PGLITE_PORT ?? 5432);

await mkdir(dataDir, { recursive: true });

const db = new PGlite(dataDir);
await db.waitReady;

const server = createServer(db);
server.listen(port, () => {
  console.log(
    `[ema-pglite] listening on postgresql://postgres@localhost:${port}/postgres`,
  );
  console.log(`[ema-pglite] data dir: ${dataDir}`);
});
