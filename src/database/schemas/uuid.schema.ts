import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const uuidSchema = sqliteTable("uuids", {
  id: integer().notNull().primaryKey({ autoIncrement: true }),
  name: text().notNull().unique(),
  uuid: text().notNull(),
  createdAt: text()
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

export type UuidModel = typeof uuidSchema.$inferSelect;
