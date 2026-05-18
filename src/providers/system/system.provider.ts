import consola from "consola";
import { existsSync } from "node:fs";
import { userInfo, type UserInfo } from "node:os";
import { join } from "node:path";
import { STR } from "../../constants/str";
import { OnInit } from "../../decorators/on-init.decorator";
import { Provider } from "../../decorators/provider.decorator";

export const SystemProviderKey = "provider.system";

@Provider()
export class SystemProvider {
  readonly arch: string;
  readonly platform: string;
  readonly hostname: string;
  readonly uptime: number;
  readonly memory: Memory;
  readonly runtime: Runtime;
  readonly root: string;
  readonly userInfo: UserInfo<string>;
  readonly shell: ShellData;
  readonly pid: number;
  private _isSudo: boolean | null;

  constructor() {
    this.hostname = Bun.env.HOSTNAME || STR.UNKNOWN;
    this.arch = process.arch;
    this.platform = process.platform;
    this.pid = process.pid;
    this.uptime = process.uptime();
    this.memory = {
      total: process.memoryUsage().heapTotal,
      free: process.memoryUsage().heapTotal - process.memoryUsage().heapUsed,
    };
    this.runtime = {
      name: typeof Bun !== "undefined" ? "bun" : "node",
      version: process.version,
    };
    this._isSudo = null;
    this.root = join(import.meta.dir, "../../../");
    this.userInfo = userInfo();
    this.shell = this.buildShellData();
    consola.success(`Program started. (PID: ${this.pid})`);
  }

  @OnInit()
  private async onInit(): Promise<void> {
    await this.isSudo();
  }

  async isSudo(): Promise<boolean> {
    if (this._isSudo !== null) return this._isSudo;
    const proc = this.cmdAsSudo(["-n", "true"], { mode: "pipe" });

    const code = await proc.exited;
    this._isSudo = code === 0;
    return this._isSudo;
  }

  cmd(
    cmd: string[],
    opts?: CmdOptions,
  ): Bun.Subprocess<
    "inherit" | "pipe",
    "inherit" | "pipe",
    "inherit" | "pipe"
  > {
    return Bun.spawn(cmd, {
      stdout: typeof opts?.mode === "object" ? opts?.mode.stdout : opts?.mode,
      stderr: typeof opts?.mode === "object" ? opts?.mode.stderr : opts?.mode,
      stdin: typeof opts?.mode === "object" ? opts?.mode.stdin : undefined,
      cwd: opts?.cwd,
    });
  }

  cmdAsSudo(
    cmd: string[],
    opts?: CmdOptions,
  ): Bun.Subprocess<
    "inherit" | "pipe",
    "inherit" | "pipe",
    "inherit" | "pipe"
  > {
    return this.cmd(["sudo", ...cmd], opts);
  }

  private buildShellData(): ShellData {
    const sl = this.userInfo.shell;
    const shellNamesSplit: string[] = sl?.split("/") || [];

    const name =
      (shellNamesSplit[shellNamesSplit.length - 1] as "zsh" | "bash") ?? "bash";

    if (name !== "zsh") throw new Error('We support only "ZSH" shell');
    const homedir = this.userInfo.homedir;
    const confDir = join(homedir, ".zshrc");
    const ohMyZshDir = join(homedir, ".oh-my-zsh");
    const hasOhMyZsh = existsSync(ohMyZshDir);
    const aliasesPath = join(ohMyZshDir, "custom", "aliases.zsh");

    return {
      name: name,
      bin: sl as string,
      confDir,
      hasOhMyZsh,
      ohMyZshDir,
      aliasesPath,
    };
  }
}

interface Memory {
  total: number;
  free: number;
}

interface Runtime {
  name: "node" | "bun";
  version: string;
}

type CmdMode = "inherit" | "pipe";
interface CmdOptions {
  /**@default "inherit" */
  mode?:
    | CmdMode
    | {
        stdout?: CmdMode;
        stderr?: CmdMode;
        stdin?: CmdMode;
      };
  cwd?: string;
}

export interface ShellData {
  name: "zsh";
  bin: string;
  confDir: string;
  hasOhMyZsh: boolean;
  ohMyZshDir?: string;
  aliasesPath: string;
}
