import { Command } from "commander";
import {
  MODULE_INJECTIONS_KEY,
  MODULE_MAIN_TARGET_KEY,
  MODULE_ON_INIT_KEY,
  MODULE_PROGRAMS_KEY,
  MODULE_PROVIDERS_EY,
} from "../constants/metadata-keys";
import type {
  InjectionMetadata,
  IProgram,
  OnInitMetadata,
} from "../constants/types";

export interface ClassProvider {
  __mainTarget: Function;
}

export type CType<T extends object = object> = new (...args: never[]) => T;

interface Provider<T> {
  name: string;
  useClass: T;
}

interface ModuleArgs {
  programs: Provider<CType<IProgram>>[];
  providers: Provider<CType>[];
}

const attachMainTarget = <T extends object>(
  instance: T,
  target: Function,
): T & ClassProvider => {
  Reflect.defineMetadata(MODULE_MAIN_TARGET_KEY, target, instance);
  return Object.assign(instance, { __mainTarget: target });
};

const applyInjections = (
  instance: object,
  providers: Map<string, object>,
  programs: Map<string, object>,
): void => {
  const injections =
    (Reflect.getMetadata(MODULE_INJECTIONS_KEY, instance.constructor) as
      | InjectionMetadata[]
      | undefined) ?? [];

  injections.forEach(({ propertyKey, providerName }) => {
    const provider = providers.get(providerName) ?? programs.get(providerName);
    if (!provider) {
      throw new Error(
        `Provider "${providerName}" for "${String(propertyKey)}" was not found`,
      );
    }

    Object.defineProperty(instance, propertyKey, {
      value: provider,
      writable: false,
      enumerable: false,
      configurable: true,
    });
  });
};

const callOnInitMethods = async (instance: object) => {
  const methods =
    (Reflect.getMetadata(MODULE_ON_INIT_KEY, instance.constructor) as
      | OnInitMetadata[]
      | undefined) ?? [];

  for (const m of methods) {
    const method = instance[
      m.propertyKey as keyof typeof instance
    ] as () => Promise<void>;
    if (typeof method !== "function") continue;
    await method.apply(instance);
  }
};

export const Module =
  (args: ModuleArgs): ClassDecorator =>
  (target) => {
    const programs = new Map(args.programs.map((p) => [p.name, p]));
    const providers = new Map(args.providers.map((p) => [p.name, p]));

    const initializedPrograms: Map<string, ClassProvider> = new Map();
    const initializedProvider: Map<string, object & ClassProvider> = new Map();

    Reflect.defineMetadata(MODULE_PROGRAMS_KEY, programs, target);
    Reflect.defineMetadata(MODULE_PROVIDERS_EY, providers, target);

    const program = new Command();

    providers.forEach((p) => {
      const pg = attachMainTarget(new p.useClass(), target);
      callOnInitMethods(pg);
      initializedProvider.set(p.name, pg);
    });

    programs.forEach((p) => {
      const pg = attachMainTarget(new p.useClass(), target);
      applyInjections(pg, initializedProvider, initializedPrograms);
      callOnInitMethods(pg);
      const cmd = pg.register(program);
      if (cmd) {
        if (Array.isArray(cmd)) cmd.forEach((c) => program.addCommand(c));
        else program.addCommand(cmd);
      }
      initializedPrograms.set(p.name, pg);
    });

    program.parse();
  };
