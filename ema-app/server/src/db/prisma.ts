import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __emaPrisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.__emaPrisma ??
  new PrismaClient({
    log: ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__emaPrisma = prisma;
}
