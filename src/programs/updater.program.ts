import type { Command } from "commander";
import consola from "consola";
import type { IProgram } from "../constants/types";
import { Inject } from "../decorators/inject.decorator";
import { Program } from "../decorators/program.decorator";
import {
  SystemProvider,
  SystemProviderKey,
} from "../providers/system/system.provider";
import { InitProgram, InitProgramKey } from "./init.program";

export const UpdaterProgramKey = "program.updater";

@Program()
export class UpdaterProgram implements IProgram {
  @Inject(SystemProviderKey)
  private readonly system: SystemProvider;

  @Inject(InitProgramKey)
  private readonly initProgram: InitProgram;

  register(command: Command): void {
    command.command("update").action(() => this.action());
  }

  private async action(): Promise<void> {
    consola.start("Starting update");
    await this.runRequiredCommand("git fetch", ["git", "fetch", "--all"]);
    await this.runRequiredCommand("git pull", ["git", "pull", "origin", "main"]);
    await this.runRequiredCommand("database migrations", [
      "bun",
      "run",
      "db:migrate",
    ]);
    await this.initProgram.action();
  }

  private async runRequiredCommand(name: string, command: string[]): Promise<void> {
    const code = await this.system
      .cmd(command, { cwd: this.system.root })
      .exited;

    if (code !== 0) {
      throw new Error(`${name} failed with exit code ${code}`);
    }
  }
}
