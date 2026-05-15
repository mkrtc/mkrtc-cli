import consola from "consola";
import { exit } from "node:process";

export const errorAndExit = (message: string | Error, exitCode = 0) => {
  consola.error(message);
  exit(exitCode);
};
