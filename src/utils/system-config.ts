import { sleep } from "bun";
import { DefaultRenderer, Listr, type ListrTaskWrapper } from "listr2";
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { hostname, uptime, userInfo, type UserInfo } from "node:os";
import { join } from "node:path";
import { AliasesRepository } from "../database/repositories/aliases.repository";
import type { AliasModel } from "../database/schemas/aliases.schema";
import { run } from "./run-script";
class SystemConfig {
  readonly hostname: string;
  readonly userInfo: UserInfo<string>;
  readonly shell: ShellData;
  readonly uptime: number;
  readonly statePath: string;
  readonly rootDir: string;
  private initialized: boolean;
  private state: State | null;
  private tasks: Listr<SystemConfig>;
  private readonly aliasesRepo: AliasesRepository;

  constructor() {
    this.statePath = join("state.json");
    this.state = null;
    this.tasks = new Listr<SystemConfig>([], { ctx: this });
    this.initialized = false;
    this.hostname = hostname();
    this.userInfo = userInfo();
    this.shell = this.buildShellData();
    this.uptime = uptime();
    this.aliasesRepo = new AliasesRepository();
    this.rootDir = join(import.meta.dir, "../../");
  }

  async init(): Promise<void> {
    this.tasks.add({
      task: (_, task) => this.installNeededDeps(task),
    });

    this.tasks.add({
      task: (_, task) => this.initState(task),
    });

    this.tasks.add({
      task: (_, task) => this.unpackArchives(task),
      title: "Unpacking files",
    });

    try {
      await this.tasks.run();
    } catch (error) {
      console.log(error);
    }
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

  private installNeededDeps(task: Task): void {
    task.output = "Проверяем установлен ли zsh...";
    if (this.shell.hasOhMyZsh) {
      task.title = "zsh уже установлен. Пропускаю";
      return;
    }

    task.output = "zsh не установлен! Установка...";
    const ohMyZshInstallationPath =
      "https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh";
    execSync(`sh -c "$(curl -fsSL ${ohMyZshInstallationPath}"`, {
      stdio: "inherit",
    });
    task.title = "zsh установлен";
  }

  async saveAliases(aliases: AliasModel[]): Promise<void> {
    const rawArray = aliases.map(
      (alias) => `alias ${alias.name}=${this.shellSingleQuote(alias.value)}`,
    );
    const raw = rawArray.join("\n") + "\n"; // финальный \n — хорошая практика
    await writeFile(this.shell.aliasesPath, raw);
  }

  private shellSingleQuote(str: string): string {
    return `'${str.replace(/'/g, `'\\''`)}'`;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getState(): State | null {
    return this.state;
  }

  private async initState(task: Task): Promise<void> {
    const aliasesPath = this.shell.aliasesPath;
    if (!existsSync(aliasesPath)) {
      await writeFile(aliasesPath, "");
    }
    const aliasesRaw = await readFile(aliasesPath);
    const aliases = await this.firstInitAndSaveAliases(aliasesRaw);
    this.state = {
      aliases,
      ssh: {},
      lastModified: "",
      uuid: {},
    };
    return;
  }

  private async firstInitAndSaveAliases(
    raw: Buffer<ArrayBuffer>,
  ): Promise<AliasModel[]> {
    const aliases = raw
      .toString()
      .split("\n")
      .map((alias) => {
        const [key, value] = alias
          .replace("alias", "")
          .split("=")
          .map((v) => v.trim().replace(/'/g, ""));
        return { [key as string]: value as string };
      })
      .reduce<Record<string, AliasModel>>((prev, cur, i) => {
        const key = Object.keys(cur)[0] as string;
        if (!key) return prev;
        prev[key] = {
          name: key,
          value: cur[key] as string,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          id: i,
        };
        return prev;
      }, {});

    for (const [key, alias] of Object.entries(aliases)) {
      const al = await this.aliasesRepo.findOneByName(key);
      if (!al) {
        await this.aliasesRepo.createAlias(alias);
      } else {
        await this.aliasesRepo.updateAliasByName(key, alias);
      }
    }

    return this.aliasesRepo.findAll();
  }

  private async unpackArchives(task: Task): Promise<void> {
    const passwordsRawDir = join(this.rootDir, "data", "passwords");
    const passwordsDir = join(this.rootDir, "static", "passwords");

    if (!existsSync(passwordsDir))
      await mkdir(passwordsDir, { recursive: true });

    const passArchives = [join(passwordsRawDir, "rockyou.txt.gz")];

    for (const pass of passArchives) {
      try {
        task.output = "Unpack: " + pass;
        const archiveName =
          pass.split("/")[pass.split("/")?.length - 1] || "password.txt";

        const tmpName = Date.now().toString() + "-" + archiveName;
        const archiveTmpPath = join(passwordsRawDir, tmpName);

        const fileName = archiveName.replace(".gz", "");
        const outDir = join(passwordsDir, fileName);

        await run("cp", [pass, archiveTmpPath]).exited;

        task.output = "Saving: " + outDir;

        await run("gzip", ["-d", archiveTmpPath]).exited;
        await sleep(1000);
        await run("mv", [archiveTmpPath.replace(".gz", ""), outDir]).exited;
      } catch (e) {
        console.log(e);
      }
    }

    task.title = "All archives successfully unpacked";
  }
}
type Task = ListrTaskWrapper<SystemConfig, typeof DefaultRenderer, any>;
export default new SystemConfig();

export interface ShellData {
  name: "zsh";
  bin: string;
  confDir: string;
  hasOhMyZsh: boolean;
  ohMyZshDir?: string;
  aliasesPath: string;
}

export interface State {
  aliases: AliasModel[];
  ssh: Record<string, Ssh>;
  uuid: Record<string, string[]>;
  lastModified: string;
}

export interface Alias {
  value: string;
  name: string;
  description: string | null;
}

export interface Ssh {
  name: string;
  user: string;
  ip: string;
  password: string | null;
  args: string[] | null;
  description: string | null;
}
