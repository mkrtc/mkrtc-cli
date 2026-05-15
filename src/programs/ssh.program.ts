import CliTable3 from "cli-table3";
import type { Command } from "commander";
import consola from "consola";
import { STR } from "../constants/str";
import type { IProgram } from "../constants/types";
import {
  SshRepository,
  SshRepositoryKey,
} from "../database/repositories/ssh.repository";
import type { SshModel } from "../database/schemas/ssh.schema";
import { Inject } from "../decorators/inject.decorator";
import {
  SystemProvider,
  SystemProviderKey,
} from "../providers/system/system.provider";
import { errorAndExit } from "../utils/error";

interface SshArgs {
  connect?: boolean;
  user?: string;
  ip?: string;
  password?: string;
  save?: boolean;
  list?: boolean;
  args?: string[];
  name?: string;
  delete?: boolean;
}

export const SshProgramKey = "program.ssh";

export class SshProgram implements IProgram {
  @Inject(SshRepositoryKey)
  private readonly sshRepository: SshRepository;
  @Inject(SystemProviderKey)
  private readonly system: SystemProvider;

  register(command: Command): void {
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
      .action((args) => this.action(args));
  }

  private async action(args: SshArgs): Promise<void> {
    if (args.list) {
      const sshModels = await this.sshRepository.findAll();
      this.printToCondole(sshModels);
    }

    if (args.save) {
      const sshpassInstalled = await this.sshpassInstalled();
      if (!sshpassInstalled) return errorAndExit(STR.SshpassNorInstalledError);
      const saved = args.name
        ? await this.sshRepository.findOneByName(args.name)
        : null;

      let sshModel: SshModel = this.sshRepository.createSshModel(
        args.name || (args.user as string),
        args.user as string,
        args.ip as string,
        args.password as string,
        args.args,
      );
      if (saved) {
        sshModel = saved;
      }

      if (!saved) {
        if (!args.name) return errorAndExit(STR.SshNameIsRequiredError);
        await this.sshRepository.createSsh(sshModel, sshModel.args);
      }

      this.printToCondole([sshModel]);
    }

    if (args.connect && args.name) {
      const sshModel = await this.sshRepository.findOneByName(args.name);
      if (!sshModel)
        return errorAndExit(STR.SshConfigNotExistsError(args.name));
      return this.connect(sshModel);
    }

    if (args.delete && args.name) {
      const sshModel = await this.sshRepository.findOneByName(args.name);
      if (!sshModel)
        return errorAndExit(STR.SshConfigNotExistsError(args.name));
      await this.sshRepository.deleteSshById(sshModel.id);
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
      const proc = this.system.cmd(connection, {
        mode: {
          stdin: "inherit",
          stdout: "inherit",
          stderr: "inherit",
        },
      });
      await proc.exited;
    } catch (e) {}
  }

  private async sshpassInstalled(): Promise<boolean> {
    const proc = this.system.cmd(["which", "sshpass"]);

    const exitCode = await proc.exited;

    return exitCode === 0;
  }

  private printToCondole(ssh: SshModel[]): void {
    const table = new CliTable3({
      head: ["ID", "name", "username", "ip", "args"],
      style: { compact: true },
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
