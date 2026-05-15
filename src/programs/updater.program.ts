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
    await this.system.cmd(["git", "fetch", "--all"], { cwd: this.system.root })
      .exited;
    await this.system.cmd(["git", "pull", "origin", "main"], {
      cwd: this.system.root,
    }).exited;
    await this.initProgram.action();
  }
}
