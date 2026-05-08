// src/database/migrate.ts
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

mkdirSync("./db", { recursive: true });

const sqlite = new Database(join("db/db.sqlite"), { create: true });
const db = drizzle(sqlite);

migrate(db, { migrationsFolder: join("db/migrations") });
sqlite.close();

console.log("✓ Migrations applied");
