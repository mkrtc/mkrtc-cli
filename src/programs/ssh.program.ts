import CliTable3 from "cli-table3";
import { Command } from "commander";
import consola from "consola";
import z from "zod";
import { STR } from "../constants/str";
import type { IProgram } from "../constants/types";
import {
  SshRepository,
  SshRepositoryKey,
} from "../database/repositories/ssh.repository";
import type { SshModel } from "../database/schemas/ssh.schema";
import { Inject } from "../decorators/inject.decorator";
import { AppException } from "../exceptions/app.exception";
import { SshConnectionNotFoundException } from "../exceptions/ssh-connection-not-found.exception";
import { ValidationException } from "../exceptions/validation.exception";
import {
  SystemProvider,
  SystemProviderKey,
} from "../providers/system/system.provider";
import { errorAndExit } from "../utils/error";
import {
  CheckConnectSshDtoSchema,
  CheckCreateAndSaveSshDtoSchema,
  type ConnectSshDto,
  type CreateAndSaveSshDto,
} from "./dto/ssh.dto";

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

  register(command: Command): Command {
    command.enablePositionalOptions();
    const sshCmd = new Command("ssh");
    sshCmd.enablePositionalOptions();

    sshCmd
      .command("save")
      .option(
        "-p, --password [password]",
        "[Optional] Password for ssh connection.",
      )
      .option("-a, --args <...string>", "Additional arguments for ssh cmd")
      .option("-c, --connect", "Connect after saving")
      .requiredOption("-n, --name <string>", "Connection name.")
      .requiredOption("-u, --user <string>", "Username")
      .requiredOption("--ip <string>", "Ip address")
      .action((args) => this.saveSshAction(args));

    sshCmd
      .command("connect")
      .option("-n, --name <string>", "Connection name")
      .action((args) => this.connectSshAction(args));

    sshCmd
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

    return sshCmd;
  }

  private async saveSshAction(args: CreateAndSaveSshDto): Promise<void> {
    const parsed = z.safeParse(CheckCreateAndSaveSshDtoSchema, args);
    if (!parsed.success)
      throw new AppException(
        parsed.error.message || "Validation error",
        "VLD-001",
      );
    const data = parsed.data;

    const sshpassInstalled = await this.sshpassInstalled();
    if (!sshpassInstalled) return errorAndExit(STR.SshpassNorInstalledError);
    const saved = args.name
      ? await this.sshRepository.findOneByName(args.name)
      : null;

    let sshModel: SshModel = this.sshRepository.createSshModel(
      data.name || (args.user as string),
      data.user as string,
      data.ip as string,
      data.password as string,
      data.args,
    );
    if (saved) {
      sshModel = saved;
    }

    if (!saved) {
      if (!args.name) return errorAndExit(STR.SshNameIsRequiredError);
      await this.sshRepository.createSsh(sshModel, sshModel.args);
    }

    this.printToCondole([sshModel]);

    if (data.connect && saved) {
      return this.connect(saved);
    }
  }

  private async connectSshAction(args: ConnectSshDto): Promise<void> {
    const parsed = z.safeParse(CheckConnectSshDtoSchema, args);
    if (!parsed.success) throw new ValidationException(parsed.error.message);
    const data = parsed.data;
    const sshModel = await this.sshRepository.findOneByName(data.name);
    if (!sshModel) throw new SshConnectionNotFoundException(data.name);

    return this.connect(sshModel);
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
      const connection = sshModel.password
        ? ["sshpass", "-p", sshModel.password, "ssh"]
        : ["ssh"];

      connection.push(
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
      head: ["ID", "name", "username", "ip", "args", "connect"],
      style: { compact: true },
    });

    const values = Object.values(ssh).map((value) => [
      value.id,
      value.name,
      value.username,
      value.ip,
      value.args?.map((arg) => arg.arg).join(", "),
      `${value.username}@${value.ip} ${value.args?.map((a) => a.arg).join(" ")}`.trim(),
    ]);
    table.push(...values);
    console.log(table.toString());
  }
}
