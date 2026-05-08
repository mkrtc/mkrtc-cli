import CliTable3 from "cli-table3";
import type { Command } from "commander";
import { STR } from "../../constants/str";
import { error } from "../../utils/error";
import type { Ssh } from "../../utils/system-config";
import systemConfig from "../../utils/system-config";

interface SshArgs {
  connect: string;
  password?: string;
  save?: boolean;
  list?: boolean;
}

export class SshModule {
  private ssh: Record<string, Ssh>;

  constructor() {
    this.getAll();
  }

  static register(command: Command): void {
    command
      .command("ssh")
      .option("-c, --connect <user@ip> or <saved_name>")
      .option("-p, --password <password> [optional]")
      .option("-r, --remove <string>")
      .option("-s, --save")
      .option("-l, --list")
      .option("-a, --args <...string>")
      .action((args: SshArgs) => {
        const module = new SshModule();

        module.action(args);
      });
  }

  private async action(args: SshArgs): Promise<void> {
    console.log(args);
  }

  private renderInCondole(): void {
    const table = new CliTable3({
      head: ["name", "username", "ip", "args", "description"],
    });

    const values = Object.values(this.ssh).map((value) => [
      value.name,
      value.user,
      value.ip,
      value.args?.join(","),
      value.description,
    ]);
    table.push(...values);
    console.log(table.toString());
  }

  private getAll(): Record<string, Ssh> {
    const state = systemConfig.getState();
    if (!systemConfig.isInitialized() || !state)
      return error(STR.StateNotInitializedError);
    this.ssh = state.ssh;

    return this.ssh;
  }
}
