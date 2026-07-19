// Prisma 7 config. The CLI (migrate/db push) uses the DIRECT (non-pooler)
// Neon connection; the app's runtime client uses the pooled DATABASE_URL via
// the pg driver adapter in lib/db.js.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DIRECT_URL"] || process.env["DATABASE_URL"],
    // shadow DB (same Neon project) lets prisma migrate diff/dev replay
    // migrations without touching real data
    // anchored on "/neondb?" so it swaps the DATABASE segment, not the
    // "neondb_owner" username
    shadowDatabaseUrl: (process.env["DIRECT_URL"] || "")
      .replace("/neondb?", "/prisma_shadow?")
      .replace("&channel_binding=require", ""),
  },
});
