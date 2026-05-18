import CliTable3 from "cli-table3";
import type { Command } from "commander";
import consola from "consola";
import { randomUUID } from "node:crypto";
import type { IProgram } from "../constants/types";
import {
  UuidRepository,
  UuidRepositoryKey,
} from "../database/repositories/uuid.repository";
import type { UuidModel } from "../database/schemas/uuid.schema";
import { Inject } from "../decorators/inject.decorator";
import { Program } from "../decorators/program.decorator";

interface UuidArgs {
  generate?: boolean;
  save?: boolean;
  list?: boolean;
  delete?: string;
  deleteAll?: boolean;
  name?: string;
  read?: string;
  quantity?: number;
  responseFormat?: string; // table | string | json
  separator?: string;
}

export const UuidProgramKey = "program.uuid";

@Program()
export class UuidProgram implements IProgram {
  @Inject(UuidRepositoryKey)
  private readonly uuidRepository: UuidRepository;

  register(command: Command): void {
    command
      .command("uuid")
      .option("-g, --generate")
      .option("-s, --save")
      .option("-l, --list")
      .option("-q, --quantity <number>")
      .option("-r, --read <...string>")
      .option("-d, --delete <...string>")
      .option("--delete-all")
      .option("-n, --name <...string>")
      .option(
        "--response-format [string]",
        'Response format. One of: "table, json, string"',
        "table",
      )
      .option(
        "--separator [string]",
        "Use only if response type is string",
        ",",
      )
      .action((args) => this.action(args));
  }

  private async action(args: UuidArgs): Promise<void> {
    if (args.list) {
      const uuidModels = await this.uuidRepository.findAll();
      consola.success("Fetched uuids list:");
      this.printToConsoleTable(uuidModels, args.responseFormat, args.separator);
    }

    if (args.read) {
      const uuidModels = await this.uuidRepository.findManyByNames(
        args.read.split(",").map((v) => v.trim()),
      );

      consola.success("Fetched uuids:");
      this.printToConsoleTable(uuidModels, args.responseFormat, args.separator);
    }

    if (args.generate) {
      const uuids: UuidModel[] = [];
      const qty = args.quantity || 1;
      for (let i = 0; i <= qty - 1; i++) {
        const names = args.name?.split(",")?.map((v) => v.trim()) || [];
        const uuid = randomUUID();
        let name = names[i] || names[0] || (uuid.split("-")[0] as string);
        name = i > 0 && name === names[0] ? `${name}_${i}` : name;
        uuids.push(this.uuidRepository.createModel(name, uuid));
      }
      consola.success("Generated uuids: ");
      this.printToConsoleTable(uuids, args.responseFormat, args.separator);

      if (args.save) {
        for (const uuid of uuids) {
          await this.uuidRepository.create(uuid);
        }
      }
    }

    if (args.delete) {
      const names = args.delete.split(",");
      for (const name of names) {
        await this.uuidRepository.deleteByNameOrUuid(name.trim());
      }
    }
  }

  private printToConsoleTable(
    uuids: UuidModel[],
    responseFormat: string = "table",
    separator: string = ",",
  ): void {
    const table = new CliTable3({
      head: ["ID", "name", "uuid", "createdAt"],
      style: {
        compact: true,
      },
    });

    const values = uuids.map((uuid) => [
      uuid.id,
      uuid.name,
      uuid.uuid,
      uuid.createdAt,
    ]);
    table.push(...values);
    if (responseFormat === "table") {
      console.log(table.toString());
    } else if (responseFormat === "json") {
      console.dir(
        JSON.stringify(
          uuids.map((uuid) => uuid.uuid),
          null,
          2,
        ),
      );
    } else {
      console.log(uuids.map((uuid) => uuid.uuid).join(separator));
    }
  }
}
