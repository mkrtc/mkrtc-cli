import { relations } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const sshSchema = sqliteTable("ssh", {
  id: integer().primaryKey({ autoIncrement: true }),
  name: text().notNull().unique(),
  username: text().notNull(),
  ip: text().notNull(),
  password: text(),
});

export const sshArgsSchema = sqliteTable("ssh_args", {
  id: integer().notNull().primaryKey({ autoIncrement: true }),
  sshId: integer("ssh_id")
    .notNull()
    .references(() => sshSchema.id, { onDelete: "cascade" }),
  arg: text().notNull(),
});

export const sshRelationsSchema = relations(sshSchema, ({ many }) => ({
  args: many(sshArgsSchema),
}));

export const sshArgsRelationsSchema = relations(sshArgsSchema, ({ one }) => ({
  ssh: one(sshSchema, {
    fields: [sshArgsSchema.sshId],
    references: [sshSchema.id],
  }),
}));

export type SshArgsModel = typeof sshArgsSchema.$inferSelect;
export type SshModel = typeof sshSchema.$inferSelect & {
  args: SshArgsModel[];
};
