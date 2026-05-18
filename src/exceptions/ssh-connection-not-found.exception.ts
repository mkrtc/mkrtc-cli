import { AppException } from "./app.exception";

export class SshConnectionNotFoundException extends AppException {
  constructor(name: string) {
    const mess = `Ssh connection "${name}" not found`;
    super(mess, "SSH-001");

    this.logAndExit(mess, 0);
  }
}
