import consola from "consola";

export class AppException extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }

  exit(code: number = 0): void {
    process.exit(code);
  }

  logAndExit(message: string, code: number): void {
    consola.error(`[${this.code}] ${message}`);
    process.exit(code);
  }
}
