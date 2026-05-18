import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const passwordSchema = sqliteTable("passwords", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  password: text("password").unique(),
});

export type PasswordModel = typeof passwordSchema.$inferSelect;
