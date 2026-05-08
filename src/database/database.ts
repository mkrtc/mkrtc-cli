import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { join } from "node:path";

const sqlite = new Database(join("db", "db.sqlite"), { create: true });
sqlite.run("PRAGMA foreign_keys = ON");
const database = drizzle(sqlite);

export default database;
