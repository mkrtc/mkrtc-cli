import CliTable3 from "cli-table3";
import type { Command } from "commander";
import consola from "consola";
import { STR } from "../../constants/str";
import { AliasesRepository } from "../../database/repositories/aliases.repository";
import type { AliasModel } from "../../database/schemas/aliases.schema";
import { error } from "../../utils/error";
import systemConfig from "../../utils/system-config";

interface AliasArgs {
  read: boolean;
  add: string;
  delete: string;
  separator?: string;
}

export class AliasModule {
  constructor(
    private readonly aliasRepo: AliasesRepository,
    private aliases: AliasModel[],
  ) {}

  static register(command: Command): void {
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
      .action(async (args: AliasArgs) => {
        const aliasesRepo = new AliasesRepository();
        const aliases = await aliasesRepo.findAll();
        const aliasModule = new AliasModule(aliasesRepo, aliases);
        aliasModule.action(args);
      });
  }

  private async action(args: AliasArgs): Promise<void> {
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
    const al = await this.aliasRepo.findOneByName(alias);
    if (al) return error(STR.AliasAlreadyExistsError(alias));

    const newAlias = await this.aliasRepo.createAlias({
      name: alias,
      value: cmd,
    });

    this.aliases.push(newAlias);

    await systemConfig.saveAliases(this.aliases);
  }

  private async deleteAlias(name: string): Promise<void> {
    const alias = await this.aliasRepo.findOneByName(name);
    if (!alias) return error(STR.AliasNotFoundError(name));
    await this.aliasRepo.removeAliasById(alias.id);
    this.aliases = this.aliases.filter((al) => al.id !== alias.id);

    await systemConfig.saveAliases(this.aliases);
  }
}
