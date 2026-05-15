import { eq, inArray, or } from "drizzle-orm";
import database from "../database";
import { uuidSchema, type UuidModel } from "../schemas/uuid.schema";

export const UuidRepositoryKey = "repository.uuid";

export class UuidRepository {
  findAll(): Promise<UuidModel[]> {
    return database.select().from(uuidSchema);
  }

  findByUuid(uuid: string): Promise<UuidModel[]> {
    return database.select().from(uuidSchema).where(eq(uuidSchema.uuid, uuid));
  }

  async findById(id: number): Promise<UuidModel | null> {
    const entities = await database
      .select()
      .from(uuidSchema)
      .where(eq(uuidSchema.id, id));
    return entities[0] || null;
  }

  async findByName(name: string): Promise<UuidModel | null> {
    const entities = await database
      .select()
      .from(uuidSchema)
      .where(eq(uuidSchema.name, name));
    return entities[0] || null;
  }

  findManyByNames(names: string[]): Promise<UuidModel[]> {
    return database
      .select()
      .from(uuidSchema)
      .where(inArray(uuidSchema.name, names));
  }

  async create(raw: typeof uuidSchema.$inferInsert): Promise<UuidModel> {
    const entities = await database
      .insert(uuidSchema)
      .values({ ...raw, id: undefined })
      .returning();

    return entities[0] as UuidModel;
  }

  createModel(name: string, uuid: string): UuidModel {
    return { id: 0, name, uuid, createdAt: new Date().toISOString() };
  }

  async deleteByName(name: string): Promise<void> {
    await database.delete(uuidSchema).where(eq(uuidSchema.name, name));
  }

  async deleteByNameOrUuid(value: string): Promise<void> {
    await database
      .delete(uuidSchema)
      .where(
        or(
          eq(uuidSchema.id, +value),
          eq(uuidSchema.name, value),
          eq(uuidSchema.uuid, value),
        ),
      );
  }

  async deleteManyByNames(names: string[]): Promise<void> {
    await database.delete(uuidSchema).where(inArray(uuidSchema.name, names));
  }

  async deleteByUuid(uuid: string): Promise<void> {
    await database.delete(uuidSchema).where(eq(uuidSchema.uuid, uuid));
  }

  async deleteById(id: number): Promise<void> {
    await database.delete(uuidSchema).where(eq(uuidSchema.id, id));
  }
}
