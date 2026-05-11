import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { join } from "node:path";
import * as aliasesSchema from "./schemas/aliases.schema";
import * as sshSchema from "./schemas/ssh.schema";
import * as uuidSchema from "./schemas/uuid.schema";

const sqlite = new Database(join(import.meta.dir, "../../db/db.sqlite"), {
  create: true,
});
sqlite.run("PRAGMA foreign_keys = ON");
const database = drizzle(sqlite, {
  schema: {
    ...sshSchema,
    ...aliasesSchema,
    ...uuidSchema,
  },
});

export default database;
