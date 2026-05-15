// src/database/migrate.ts
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { getDbPath, getMigrationsPath } from "./path";

const dbPath = getDbPath();
const sqlite = new Database(dbPath, { create: true });
const db = drizzle(sqlite);

migrate(db, { migrationsFolder: getMigrationsPath() });
sqlite.close();

console.log(`✓ Migrations applied: ${dbPath}`);
