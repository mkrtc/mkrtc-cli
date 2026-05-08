import consola from "consola";
import { exit } from "node:process";


export const error = (message: string, exitCode = 0) => {
    consola.error(message);
    exit(exitCode)
}