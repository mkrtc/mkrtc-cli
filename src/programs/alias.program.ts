import CliTable3 from "cli-table3";
import type { Command } from "commander";
import consola from "consola";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { STR } from "../constants/str";
import type { IProgram } from "../constants/types";
import {
  AliasesRepository,
  AliasesRepositoryKey,
} from "../database/repositories/aliases.repository";
import type { AliasModel } from "../database/schemas/aliases.schema";
import { Inject } from "../decorators/inject.decorator";
import {
  SystemProvider,
  SystemProviderKey,
} from "../providers/system/system.provider";
import { errorAndExit } from "../utils/error";

interface AliasArgs {
  read: boolean;
  add: string;
  delete: string;
  separator?: string;
}

export const AliasProgramKey = "program.alias";

export class AliasProgram implements IProgram {
  @Inject(AliasesRepositoryKey)
  private readonly aliasesRepository: AliasesRepository;

  @Inject(SystemProviderKey)
  private readonly system: SystemProvider;

  private aliases: AliasModel[];

  register(command: Command): void {
    command
      .command("alias")
      .option("-r, --read", STR.ReadAliasOption)
      .option("-a, --add <name=value-description>", STR.AddAliasOption)
      .option("-d, --delete <...string>", STR.RemoveAliasOption)
      .option(
        "-s, --separator <string>",
        "The specific separator for -a. exp: mkrtc -a test1=hello<separator>test2=world -s=,",
        ",",
      )
      .action((args) => this.action(args));
  }

  async initAndSaveAliases(): Promise<void> {
    const aliasesPath = this.system.shell.aliasesPath;
    if (!existsSync(aliasesPath)) {
      await writeFile(aliasesPath, "");
    }
    const aliasesRaw = await readFile(aliasesPath);

    const aliases = aliasesRaw
      .toString()
      .split("\n")
      .map((alias) => {
        const [key, value] = alias
          .replace("alias", "")
          .split("=")
          .map((v) => v.trim().replace(/'/g, ""));
        return { [key as string]: value as string };
      })
      .reduce<Record<string, AliasModel>>((prev, cur, i) => {
        const key = Object.keys(cur)[0] as string;
        if (!key) return prev;
        prev[key] = {
          name: key,
          value: cur[key] as string,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          id: i,
        };
        return prev;
      }, {});

    for (const [key, alias] of Object.entries(aliases)) {
      const al = await this.aliasesRepository.findOneByName(key);
      if (!al) {
        await this.aliasesRepository.createAlias(alias);
      } else {
        await this.aliasesRepository.updateAliasByName(key, alias);
      }
    }
  }

  private async action(args: AliasArgs): Promise<void> {
    this.aliases = await this.aliasesRepository.findAll();
    if (args.read) {
      this.renderInConsole();
    }
    if (args.add) {
      const newAliasesRaw = args.add.split(",");
      for (const raw of newAliasesRaw) {
        const [name, ...cmd] = raw.split("=");
        await this.addAlias(name as string, cmd.join("="));
      }
    }

    if (args.delete) {
      const aliases = args.delete.split(",");
      for (const alias of aliases) {
        await this.deleteAlias(alias);
      }
    }

    consola.success(
      "Config saved. Run `source ~/.zshrc` or open a new terminal.",
    );
  }

  private renderInConsole(): void {
    const table = new CliTable3({
      head: ["ID", "Alias", "cmd"],
      style: { compact: true },
    });
    const values: [number, string, string][] = this.aliases.map((alias) => [
      alias.id,
      alias.name,
      alias.value,
    ]);
    table.push(...values);

    console.log(table.toString());
  }

  private async addAlias(alias: string, cmd: string): Promise<void> {
    const al = await this.aliasesRepository.findOneByName(alias);
    if (al) return errorAndExit(STR.AliasAlreadyExistsError(alias));

    const newAlias = await this.aliasesRepository.createAlias({
      name: alias,
      value: cmd,
    });

    this.aliases.push(newAlias);

    await this.saveAliases();
  }

  private async deleteAlias(name: string): Promise<void> {
    const alias = await this.aliasesRepository.findOneByName(name);
    if (!alias) return errorAndExit(STR.AliasNotFoundError(name));
    await this.aliasesRepository.removeAliasById(alias.id);
    this.aliases = this.aliases.filter((al) => al.id !== alias.id);

    await this.saveAliases();
  }

  private async saveAliases(): Promise<void> {
    const rawArray = this.aliases.map(
      (alias) => `alias ${alias.name}=${this.shellSingleQuote(alias.value)}`,
    );
    const raw = rawArray.join("\n") + "\n"; // финальный \n — хорошая практика
    await writeFile(this.system.shell.aliasesPath, raw);
  }

  private shellSingleQuote(str: string): string {
    return `'${str.replace(/'/g, `'\\''`)}'`;
  }
}
