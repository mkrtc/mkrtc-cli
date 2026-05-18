import type { Command } from "commander";

export interface IProgram {
  register(command: Command): void | Command | Command[];
}

export interface InjectionMetadata {
  propertyKey: string | symbol;
  providerName: string;
}

export interface OnInitMetadata {
  propertyKey: string | symbol;
}
