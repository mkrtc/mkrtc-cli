import { AppException } from "./app.exception";

export class ValidationException extends AppException {
  constructor(message: string) {
    super(message, "VLD-001");
    const mess = `Validation error:\n` + message;
    this.logAndExit(mess, 0);
  }
}
