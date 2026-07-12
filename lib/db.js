// Prisma client singleton (server-only). Prisma 7 has no bundled engine —
// it talks to Neon through the pg driver adapter using the POOLED url.
import { PrismaClient } from "./generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const g = globalThis;

export const prisma =
  g.__prisma ??
  (g.__prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  }));
