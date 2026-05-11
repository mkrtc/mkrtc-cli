import CliTable3 from "cli-table3";
import type { Command } from "commander";
import consola from "consola";
import { STR } from "../../constants/str";
import { SshRepository } from "../../database/repositories/ssh.repository";
import type { SshModel } from "../../database/schemas/ssh.schema";
import { error } from "../../utils/error";

interface SshArgs {
  connect?: boolean;
  username?: string;
  ip?: string;
  password?: string;
  save?: boolean;
  list?: boolean;
  args?: string[];
  name?: string;
  delete?: boolean;
}

export class SshModule {
  constructor(private readonly sshRepo: SshRepository) {}

  static register(command: Command): void {
    command
      .command("ssh")
      .option("-c, --connect")
      .option("-p, --password <string> [optional]")
      .option("-r, --remove <string>")
      .option("-s, --save")
      .option("-l, --list")
      .option("-a, --args <...string>")
      .option("-n, --name <string>")
      .option("-u, --user <string>")
      .option("--ip <string>")
      .option("-d, --delete")
      .action((args: SshArgs) => {
        const sshRepo = new SshRepository();
        const module = new SshModule(sshRepo);

        return module.action(args);
      });
  }

  private async action(args: SshArgs): Promise<void> {
    if (args.list) {
      const sshModels = await this.sshRepo.findAll();
      this.printToCondole(sshModels);
    }

    if (args.save) {
      const sshpassInstalled = await this.sshpassInstalled();
      if (!sshpassInstalled) return error(STR.SshpassNorInstalledError);
      const saved = args.name
        ? await this.sshRepo.findOneByName(args.name)
        : null;

      let sshModel: SshModel = this.sshRepo.createSshModel(
        args.name || (args.username as string),
        args.username as string,
        args.ip as string,
        args.password as string,
        args.args,
      );
      if (saved) {
        sshModel = saved;
      }

      if (!saved) {
        if (!args.name) return error(STR.SshNameIsRequiredError);
        await this.sshRepo.createSsh(sshModel, sshModel.args);
      }

      this.printToCondole([sshModel]);
    }

    if (args.connect && args.name) {
      const sshModel = await this.sshRepo.findOneByName(args.name);
      if (!sshModel) return error(STR.SshConfigNotExistsError(args.name));
      return this.connect(sshModel);
    }

    if (args.delete && args.name) {
      const sshModel = await this.sshRepo.findOneByName(args.name);
      if (!sshModel) return error(STR.SshConfigNotExistsError(args.name));
      await this.sshRepo.deleteSshById(sshModel.id);
      consola.success(`SSH connection "${args.name}" successfully deleted`);
    }
  }

  private async connect(sshModel: SshModel): Promise<void> {
    try {
      const connection = ["sshpass"];
      if (sshModel.password) {
        connection.push("-p", sshModel.password);
      }
      connection.push(
        "ssh",
        "-o",
        "ConnectTimeout=5",
        ...sshModel.args.map((arg) => arg.arg),
        `${sshModel.username}@${sshModel.ip}`,
      );
      const proc = Bun.spawn(connection, {
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
      });
      await proc.exited;
    } catch (e) {}
  }

  private async sshpassInstalled(): Promise<boolean> {
    const proc = Bun.spawn(["which", "sshpass"]);

    const exitCode = await proc.exited;

    return exitCode === 0;
  }

  private printToCondole(ssh: SshModel[]): void {
    const table = new CliTable3({
      head: ["ID", "name", "username", "ip", "args"],
    });

    const values = Object.values(ssh).map((value) => [
      value.id,
      value.name,
      value.username,
      value.ip,
      value.args?.map((arg) => arg.arg).join(", "),
    ]);
    table.push(...values);
    console.log(table.toString());
  }
}
