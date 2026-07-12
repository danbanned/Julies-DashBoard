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
  },
});
