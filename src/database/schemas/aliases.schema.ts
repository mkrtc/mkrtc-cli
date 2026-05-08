import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const aliasesSchema = sqliteTable("aliases", {
  id: integer("id").primaryKey({ autoIncrement: true }).notNull(),
  name: text("name").notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
  createdAt: text()
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text()
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`)
    .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
});

export type AliasModel = typeof aliasesSchema.$inferSelect;
