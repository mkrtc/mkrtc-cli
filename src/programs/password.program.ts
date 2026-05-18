import type { Command } from "commander";
import { createReadStream } from "fs";
import ora from "ora";
import { join } from "path";
import { createInterface } from "readline";
import type { IProgram } from "../constants/types";
import {
  PasswordRepository,
  PasswordRepositoryKey,
} from "../database/repositories/password.repository";
import { Inject } from "../decorators/inject.decorator";
import { Program } from "../decorators/program.decorator";
import {
  SystemProvider,
  SystemProviderKey,
} from "../providers/system/system.provider";

export const PasswordProgramKey = "program.password";

export interface PasswordArgs {
  quantity?: boolean;
  generate?: boolean;
  check?: string;
}

@Program()
export class PasswordProgram implements IProgram {
  @Inject(PasswordRepositoryKey)
  private readonly passwordRepository: PasswordRepository;

  @Inject(SystemProviderKey)
  private readonly system: SystemProvider;

  register(command: Command): void {
    command
      .command("pass")
      .option("-q, --quantity", "Display all passwords count")
      .option("-g, --generate", "Generate secure password")
      .option("-c, --check <string>", "Check your password to our db.")
      .action((args) => this.action(args));
  }

  async action(args: PasswordArgs): Promise<void> {
    if (args.quantity) {
      const spinner = ora().start("Reading passwords quantity...");
      const qty = await this.passwordRepository.count();
      spinner.succeed(`Passwords: ${qty}`);
    }

    if (args.check) {
      const spinner = ora().start("Checking your password in db...");
      const pass = await this.passwordRepository.findOneByPassword(
        args.check.trim(),
      );
      if (pass) {
        spinner.color = "red";
        spinner.fail(
          "Your password is in the list on the most popular passwords",
        );
      } else {
        spinner.color = "gray";
        spinner.succeed(
          "Your password doesn't is in the list on the most popular passwords",
        );
      }
    }
  }

  async initPasswords(): Promise<void> {
    const passwordsDir = join(this.system.root, "static", "passwords");
    const passwordsPath = [join(passwordsDir, "rockyou.txt")];
    const batchSize = 5000;

    const totalPasswords = await this.countPasswords(passwordsPath);
    const spinner = ora().start(`Saving passwords: 0 / ${totalPasswords}`);

    await this.passwordRepository.createOrUpdateManyPasswordBatches(
      this.readPasswordBatches(passwordsPath, batchSize),
      totalPasswords,
      (added, all) => {
        spinner.text = `Saving passwords: ${added} / ${all}`;
      },
    );

    spinner.succeed("All passwords successfully saved");
  }

  private async countPasswords(paths: string[]): Promise<number> {
    let total = 0;

    for (const path of paths) {
      const spinner = ora().start(`Reading ${path}`);
      let count = 0;

      const rl = createInterface({
        input: createReadStream(path, { encoding: "utf-8" }),
        crlfDelay: Infinity,
      });

      for await (const _line of rl) {
        count++;

        if (count % 100_000 === 0) {
          spinner.text = `Reading ${path}: ${count}`;
        }
      }

      total += count;
      spinner.succeed(`${path} successfully read (${count})`);
    }

    return total;
  }

  private async *readPasswordBatches(
    paths: string[],
    batchSize: number,
  ): AsyncGenerator<string[]> {
    for (const path of paths) {
      let batch: string[] = [];
      const rl = createInterface({
        input: createReadStream(path, { encoding: "utf-8" }),
        crlfDelay: Infinity,
      });

      for await (const line of rl) {
        batch.push(line.trim());

        if (batch.length >= batchSize) {
          yield batch;
          batch = [];
        }
      }

      if (batch.length > 0) yield batch;
    }
  }
}
