import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/database/schemas/*.schema.ts", // glob
  out: "./db/migrations",
  dbCredentials: { url: "./db/db.sqlite" },
});
