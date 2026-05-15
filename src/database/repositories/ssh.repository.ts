import { eq } from "drizzle-orm";
import database from "../database";
import {
  sshArgsSchema,
  sshSchema,
  type SshArgsModel,
  type SshModel,
} from "../schemas/ssh.schema";

export const SshRepositoryKey = "repository.ssh";

export class SshRepository {
  findAll(): Promise<SshModel[]> {
    return database.query.sshSchema.findMany({
      with: {
        args: true,
      },
    });
  }

  async findOneById(id: number): Promise<SshModel | null> {
    const entity = await database.query.sshSchema.findFirst({
      where: eq(sshSchema.id, id),
      with: { args: true },
    });
    return entity || null;
  }

  async findOneByName(name: string): Promise<SshModel | null> {
    const entity = await database.query.sshSchema.findFirst({
      where: eq(sshSchema.name, name),
      with: { args: true },
    });

    return entity || null;
  }

  async createSsh(
    ssh: typeof sshSchema.$inferInsert,
    args: (typeof sshArgsSchema.$inferInsert)[],
  ): Promise<SshModel> {
    const sshEntities = await database
      .insert(sshSchema)
      .values({ ...ssh, id: undefined })
      .returning();
    const sshEntity = sshEntities[0];

    const argEntities: SshArgsModel[] = args.length
      ? await database
          .insert(sshArgsSchema)
          .values(
            args.map((a) => ({
              ...a,
              sshId: sshEntity?.id || 0,
              id: undefined,
            })),
          )
          .returning()
      : [];

    return {
      ...(sshEntity as SshModel),
      args: argEntities,
    };
  }

  createSshModel(
    name: string,
    username: string,
    ip: string,
    password: string,
    args?: string[],
  ): SshModel {
    return {
      args:
        args
          ?.flatMap((arg) => arg.split(","))
          .map((arg) => arg.trim())
          .filter(Boolean)
          .map((arg) => ({ arg, id: 0, sshId: 0 })) || [],
      id: 0,
      ip,
      name,
      password,
      username,
    };
  }

  async deleteSshById(id: number): Promise<void> {
    await database.delete(sshSchema).where(eq(sshSchema.id, id));
    await database.delete(sshArgsSchema).where(eq(sshArgsSchema.sshId, id));
  }

  async deleteSshArgById(id: number): Promise<void> {
    await database.delete(sshArgsSchema).where(eq(sshArgsSchema.id, id));
  }

  async deleteSshByName(name: string): Promise<void> {
    const sshEntity = await this.findOneByName(name);
    if (!sshEntity) return;
    await database.delete(sshSchema).where(eq(sshSchema.id, sshEntity.id));
    await database
      .delete(sshArgsSchema)
      .where(eq(sshArgsSchema.sshId, sshEntity.id));
  }
}
