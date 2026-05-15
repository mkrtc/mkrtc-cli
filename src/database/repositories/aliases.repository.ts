import { eq } from "drizzle-orm";
import database from "../database";
import { aliasesSchema, type AliasModel } from "../schemas/aliases.schema";

export const AliasesRepositoryKey = "repository.aliases";

export class AliasesRepository {
  async findOneById(id: number): Promise<AliasModel | null> {
    const entities = await database
      .select()
      .from(aliasesSchema)
      .where(eq(aliasesSchema.id, id));
    return entities[0] || null;
  }

  async findOneByName(name: string): Promise<AliasModel | null> {
    const entities = await database
      .select()
      .from(aliasesSchema)
      .where(eq(aliasesSchema.name, name));
    return entities[0] || null;
  }

  async findAll(): Promise<AliasModel[]> {
    return database.select().from(aliasesSchema);
  }

  async createAlias(
    raw: typeof aliasesSchema.$inferInsert,
  ): Promise<AliasModel> {
    const entity = await database.insert(aliasesSchema).values(raw).returning();
    return entity[0] as AliasModel;
  }

  async updateAliasById(
    id: number,
    values: typeof aliasesSchema.$inferInsert,
  ): Promise<void> {
    await database
      .update(aliasesSchema)
      .set(values)
      .where(eq(aliasesSchema.id, id));
  }

  async updateAliasByName(
    name: string,
    values: typeof aliasesSchema.$inferInsert,
  ): Promise<void> {
    await database
      .update(aliasesSchema)
      .set(values)
      .where(eq(aliasesSchema.name, name));
  }

  async removeAliasById(id: number): Promise<void> {
    await database.delete(aliasesSchema).where(eq(aliasesSchema.id, id));
  }

  async removeAliasByName(name: string): Promise<void> {
    await database.delete(aliasesSchema).where(eq(aliasesSchema.name, name));
  }
}
