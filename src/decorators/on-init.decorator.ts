import { MODULE_ON_INIT_KEY } from "../constants/metadata-keys";
import type { OnInitMetadata } from "../constants/types";

export const OnInit =
  (): MethodDecorator => (target, propertyKey, descriptor) => {
    const constructor = target.constructor;
    if (
      typeof target[propertyKey.toString() as keyof typeof target] !==
      "function"
    )
      throw new Error(
        `${target.constructor.name}.${propertyKey.toString()} is not a function`,
      );
    const injections =
      Reflect.getOwnMetadata(MODULE_ON_INIT_KEY, constructor) ?? [];

    Reflect.defineMetadata(
      MODULE_ON_INIT_KEY,
      [
        ...injections,
        {
          propertyKey,
        } satisfies OnInitMetadata,
      ],
      constructor,
    );
  };
