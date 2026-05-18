import { eq } from "drizzle-orm";
import database from "../database";
import { passwordSchema, type PasswordModel } from "../schemas/password.schema";

export const PasswordRepositoryKey = "repository.password";

export class PasswordRepository {
  findAll(): Promise<PasswordModel[]> {
    return database.query.passwordSchema.findMany();
  }

  async findOneByPassword(password: string): Promise<PasswordModel | null> {
    const entity = await database.query.passwordSchema.findFirst({
      where: eq(passwordSchema.password, password),
    });
    return entity || null;
  }

  async findOneById(id: number): Promise<PasswordModel | null> {
    const entity = await database.query.passwordSchema.findFirst({
      where: eq(passwordSchema.id, id),
    });
    return entity || null;
  }

  async createPassword(password: string): Promise<PasswordModel> {
    const entity = await database
      .insert(passwordSchema)
      .values({ password })
      .returning();
    return entity[0] as PasswordModel;
  }

  async createOrUpdateManyPasswords(
    passwords: string[],
    onUpdate?: (added: number, all: number) => void,
  ): Promise<void> {
    const batchSize = 5000;
    const batches = async function* (): AsyncGenerator<string[]> {
      for (let i = 0; i < passwords.length; i += batchSize) {
        yield passwords.slice(i, i + batchSize);
      }
    };

    await this.createOrUpdateManyPasswordBatches(
      batches(),
      passwords.length,
      onUpdate,
    );
  }

  async createOrUpdateManyPasswordBatches(
    passwordBatches: AsyncIterable<string[]>,
    total: number,
    onUpdate?: (added: number, all: number) => void,
  ): Promise<void> {
    let added = 0;
    let lastYieldAt = 0;

    onUpdate?.(added, total);

    await database.transaction(async (tx) => {
      for await (const passwords of passwordBatches) {
        if (passwords.length === 0) continue;

        await tx
          .insert(passwordSchema)
          .values(passwords.map((password) => ({ password })))
          .onConflictDoNothing({
            target: passwordSchema.password,
          });

        added += passwords.length;
        onUpdate?.(added, total);

        if (added - lastYieldAt >= 50_000) {
          lastYieldAt = added;
          await Bun.sleep(0);
        }
      }
    });
  }

  count(): Promise<number> {
    return database.$count(passwordSchema);
  }
}
