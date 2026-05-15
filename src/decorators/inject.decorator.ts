import { MODULE_INJECTIONS_KEY } from "../constants/metadata-keys";
import type { InjectionMetadata } from "../constants/types";

export const Inject =
  (providerName: string): PropertyDecorator =>
  (target, propertyKey) => {
    const constructor = target.constructor;
    const injections =
      Reflect.getOwnMetadata(MODULE_INJECTIONS_KEY, constructor) ?? [];

    Reflect.defineMetadata(
      MODULE_INJECTIONS_KEY,
      [
        ...injections,
        {
          propertyKey,
          providerName,
        } satisfies InjectionMetadata,
      ],
      constructor,
    );
  };
