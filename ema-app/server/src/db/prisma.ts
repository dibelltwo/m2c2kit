import { PGlite } from "@electric-sql/pglite";
import { PrismaClient } from "@prisma/client";
import { PrismaPGlite } from "pglite-prisma-adapter";

declare global {
  // eslint-disable-next-line no-var
  var __emaPrisma: PrismaClient | undefined;
}

const pgliteDataDir = process.env.PGLITE_DATA_DIR?.trim();
const pgliteAdapter = pgliteDataDir
  ? new PrismaPGlite(new PGlite(pgliteDataDir))
  : undefined;

export const prisma =
  globalThis.__emaPrisma ??
  new PrismaClient(
    (pgliteAdapter
      ? { adapter: pgliteAdapter, log: ["warn", "error"] }
      : { log: ["warn", "error"] }) as ConstructorParameters<
      typeof PrismaClient
    >[0],
  );

if (process.env.NODE_ENV !== "production") {
  globalThis.__emaPrisma = prisma;
}
