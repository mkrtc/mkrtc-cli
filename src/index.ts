#!/usr/bin/env bun
import { Command } from "commander";
import "./database/database";
import { AliasModule } from "./modules/alias/alias.module";
import { SshModule } from "./modules/ssh/ssh.module";
import { UuidModule } from "./modules/uuid/uuid.module";
import systemConfig from "./utils/system-config";

const program = new Command();

program.command("init").action(() => systemConfig.init());

AliasModule.register(program);
SshModule.register(program);
UuidModule.register(program);

program.parse();
