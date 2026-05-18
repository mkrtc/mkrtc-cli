import type { Command } from "commander";
import consola from "consola";
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { IProgram } from "../constants/types";
import { Inject } from "../decorators/inject.decorator";
import { Program } from "../decorators/program.decorator";
import {
  SystemProvider,
  SystemProviderKey,
} from "../providers/system/system.provider";
import { AliasProgram, AliasProgramKey } from "./alias.program";
import { PasswordProgram, PasswordProgramKey } from "./password.program";

export const InitProgramKey = "program.init";

@Program()
export class InitProgram implements IProgram {
  @Inject(SystemProviderKey)
  private readonly system: SystemProvider;
  @Inject(AliasProgramKey)
  private readonly aliasProgram: AliasProgram;
  @Inject(PasswordProgramKey)
  private readonly passwordProgram: PasswordProgram;

  constructor() {}

  register(command: Command): void {
    command.command("init").action(() => {
      return this.action();
    });
  }

  async action(): Promise<void> {
    await this.installNeededDeps();
    await this.unpackArchives();
    await this.aliasProgram.initAndSaveAliases();
    await this.passwordProgram.initPasswords();
  }

  private async installNeededDeps(): Promise<void> {
    consola.start("Checking oh-my-zsh installation...");
    if (this.system.shell.hasOhMyZsh) {
      consola.success("oh-my-zsh already installed. Continue...");
      return;
    }

    const prompt = await consola.prompt("Do you want to install oh-my-zsh?", {
      type: "select",
      options: [
        { label: "yes", value: "yes" },
        { label: "no", value: "no" },
      ],
    });

    if (prompt !== "no") return process.exit(0);

    consola.start("Starting installation oh-my-zsh...");
    const ohMyZshInstallationPath =
      "https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh";

    execSync(`sh -c "$(curl -fsSL ${ohMyZshInstallationPath}"`, {
      stdio: "inherit",
    });

    consola.success("oh-my-zsh successfully installed");
  }

  private async unpackArchives(): Promise<void> {
    const passwordsRawDir = join(this.system.root, "data", "passwords");
    const passwordsDir = join(this.system.root, "static", "passwords");

    if (!existsSync(passwordsDir))
      await mkdir(passwordsDir, { recursive: true });

    const passArchives = [join(passwordsRawDir, "rockyou.txt.gz")];

    for (const pass of passArchives) {
      try {
        const archiveName =
          pass.split("/")[pass.split("/")?.length - 1] || "password.txt";

        const tmpName = Date.now().toString() + "-" + archiveName;
        const archiveTmpPath = join(passwordsRawDir, tmpName);

        const fileName = archiveName.replace(".gz", "");
        const outDir = join(passwordsDir, fileName);

        if (existsSync(outDir)) {
          consola.success(`${fileName} already unpacked. Continue...`);
          continue;
        }

        await this.system.cmd(["cp", pass, archiveTmpPath]).exited;

        await this.system.cmd(["gzip", "-d", archiveTmpPath]).exited;

        await this.system.cmd(["mv", archiveTmpPath.replace(".gz", ""), outDir])
          .exited;
      } catch (e) {
        consola.error(e);
      }
    }
  }
}
