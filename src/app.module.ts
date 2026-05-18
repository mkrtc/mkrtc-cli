import "reflect-metadata";
import {
  AliasesRepository,
  AliasesRepositoryKey,
} from "./database/repositories/aliases.repository";
import {
  PasswordRepository,
  PasswordRepositoryKey,
} from "./database/repositories/password.repository";
import {
  SshRepository,
  SshRepositoryKey,
} from "./database/repositories/ssh.repository";
import {
  UuidRepository,
  UuidRepositoryKey,
} from "./database/repositories/uuid.repository";
import { Module } from "./decorators/module.decorator";
import { AliasProgram, AliasProgramKey } from "./programs/alias.program";
import {
  BruteForceProgram,
  BruteForceProgramKey,
} from "./programs/brute-force.program";
import { InitProgram, InitProgramKey } from "./programs/init.program";
import {
  PasswordProgram,
  PasswordProgramKey,
} from "./programs/password.program";
import { SshProgram, SshProgramKey } from "./programs/ssh.program";
import { UpdaterProgram, UpdaterProgramKey } from "./programs/updater.program";
import { UuidProgram, UuidProgramKey } from "./programs/uuid.program";
import {
  SystemProvider,
  SystemProviderKey,
} from "./providers/system/system.provider";

@Module({
  programs: [
    { name: AliasProgramKey, useClass: AliasProgram },
    { name: PasswordProgramKey, useClass: PasswordProgram },
    { name: InitProgramKey, useClass: InitProgram },
    { name: UpdaterProgramKey, useClass: UpdaterProgram },
    { name: UuidProgramKey, useClass: UuidProgram },
    { name: SshProgramKey, useClass: SshProgram },
    { name: BruteForceProgramKey, useClass: BruteForceProgram },
  ],
  providers: [
    { name: SystemProviderKey, useClass: SystemProvider },
    { name: UuidRepositoryKey, useClass: UuidRepository },
    { name: AliasesRepositoryKey, useClass: AliasesRepository },
    { name: SshRepositoryKey, useClass: SshRepository },
    { name: PasswordRepositoryKey, useClass: PasswordRepository },
  ],
})
export class MainModule {}
