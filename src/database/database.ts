import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { getDbPath, getMigrationsPath } from "./path";
import * as aliasesSchema from "./schemas/aliases.schema";
import * as passwordSchema from "./schemas/password.schema";
import * as sshSchema from "./schemas/ssh.schema";
import * as uuidSchema from "./schemas/uuid.schema";

const sqlite = new Database(getDbPath(), {
  create: true,
});

sqlite.run("PRAGMA foreign_keys = ON");
const database = drizzle(sqlite, {
  schema: {
    ...sshSchema,
    ...aliasesSchema,
    ...uuidSchema,
    ...passwordSchema,
  },
});

migrate(database, { migrationsFolder: getMigrationsPath() });

export default database;
