import type { Command } from "commander";
import consola from "consola";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Charset } from "../constants/str";
import type { IProgram } from "../constants/types";
import { Inject } from "../decorators/inject.decorator";
import { OnInit } from "../decorators/on-init.decorator";
import {
  SystemProviderKey,
  type SystemProvider,
} from "../providers/system/system.provider";
import { errorAndExit } from "../utils/error";

interface BruteForceArgs {
  value?: string;
  len?: string;
  symbols: string;
  wifi?: boolean;
  onlyCheckInList: boolean;
}

export const BruteForceProgramKey = "program.brute_force";

export class BruteForceProgram implements IProgram {
  @Inject(SystemProviderKey)
  private readonly system: SystemProvider;
  private passwords: Set<string>;
  private passwordsFileDir: string;

  @OnInit()
  private onInit(): void {
    this.passwordsFileDir = join(
      this.system.root,
      "static",
      "passwords",
      "rockyou.txt",
    );
  }

  register(command: Command): void {
    command
      .command("bf")
      .option("-v, --value <string>")
      .option("-l, --len <number>", "Password length")
      .option("-s, --symbols <...string>", "Type", "0-9")
      .option("--wifi", "Brute force wifi connection")
      .option("--only-check-in-list", "", false)
      .action((args) => this.action(args));
  }

  private async action(args: BruteForceArgs) {
    await this.readPasswords();
    const chars = this.parseCharset(args.symbols);
    const combination = this.parse(
      chars,
      args.len ? +args.len : args.value?.length || 0,
      args.value || "",
      args.onlyCheckInList,
    );
  }

  private async scanWifi() {
    consola.debug("Detecting sudo mode...");
    const isSudoMode = await this.system.isSudo();
    if (!isSudoMode) return errorAndExit('Please run script as "sudo" mode');

    consola.success("sudo enabled");

    consola.debug("Detecting wifi interface");
    const iface = await this.getWifiInterface();
    if (!iface) return errorAndExit("WIFI interface not found");
    consola.success(`WIFI interface detected: ${iface}`);

    await this.system.cmdAsSudo(["ip", "link", "set", iface, "down"]).exited;

    consola.debug('Enabling wifi type to: "monitor"');
    // monitor mode
    await this.system.cmdAsSudo(["iw", "dev", iface, "set", "type", "monitor"])
      .exited;
    const wifiMonitorIsEnabled = await this.monitorIsEnabled(iface);

    // up
    await this.system.cmdAsSudo(["ip", "link", "set", iface, "up"]).exited;

    if (!wifiMonitorIsEnabled)
      return errorAndExit(
        "Can't enable wifi monitor. Please check your wifi module",
      );

    consola.success("WIFI monitor successfully enabled");

    // capture EAPOL
    const capture = this.system.cmdAsSudo([
      "tcpdump",
      "-i",
      iface,
      "-w",
      "handshake.pcap",
    ]);

    await capture.exited;
  }

  private async getWifiInterface(): Promise<string | null> {
    const proc = Bun.spawn(["iw", "dev"], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const text = await new Response(proc.stdout).text();

    await proc.exited;

    const match = text.match(/Interface\s+(\w+)/);

    return match?.[1] ?? null;
  }

  private async monitorIsEnabled(iface: string): Promise<boolean> {
    const proc = this.system.cmd(["iw", "dev"], { mode: "pipe" });

    const text = await new Response(proc.stdout).text();

    await proc.exited;

    const match = new RegExp(
      `Interface\\s+${iface}[\\s\\S]*?type\\s+monitor`,
    ).test(text);

    return !!match;
  }

  private parseCharset(charset: string): string[] {
    return charset
      .split(",")
      .flatMap<string[]>((value) => {
        const chars = Charset[value];
        return chars || [];
      })
      .flat();
  }

  private async readPasswords(): Promise<void> {
    consola.start("reading passwords");
    const passwordsTxt = await readFile(this.passwordsFileDir);
    this.passwords = new Set(passwordsTxt.toString().split("\n"));
    consola.ready(
      `successfully read passwords.txt. Read ${this.passwords.size} passwords`,
    );
  }

  private parse(
    chars: string[],
    len: number,
    value: string,
    onlyList: boolean = false,
  ): Combination {
    const started = Date.now();
    const combinations = chars.length ** len;
    let lastCombination: Combination = {
      isEqual: false,
      iteration: 0,
      parsedValue: "0000",
      value,
      started,
      ended: 0,
      durationSec: 0,
      fromFile: false,
    };

    const isPopularPassword = this.passwords.has(value);
    if (isPopularPassword) {
      consola.success(
        "Your password is in the list on the most popular passwords",
      );
      const ended = Date.now();
      const durationSec = (ended - started) / 1000;
      return {
        isEqual: true,
        fromFile: true,
        durationSec,
        ended,
        iteration: 0,
        parsedValue: value,
        started,
        value,
      };
    }

    consola.success(
      "Your password not in the list on the most popular passwords",
    );
    if (onlyList) return lastCombination;
    consola.success("Running brute force for: " + value);

    for (let i = 0; i < combinations; i++) {
      let n = i;
      let out = "";

      for (let j = 0; j < len; j++) {
        out = chars[n % chars.length] + out;
        n = Math.floor(n / chars.length);
      }

      const isEqual = out === value;

      const ended = Date.now();
      const durationSec = (ended - started) / 1000;
      consola.success(
        `iteration: ${i}. Checking: ${value} = ${out}. match: ${isEqual ? "yes" : "no"}, duration: ${durationSec.toFixed(2)}s`,
      );

      if (out === value) {
        consola.success(
          `Password successfully brute forced. Password: ${out}. Duration: ${durationSec.toFixed(2)} sec.`,
        );

        lastCombination = {
          isEqual: true,
          iteration: i,
          parsedValue: out,
          value,
          started,
          ended,
          durationSec,
          fromFile: false,
        };
        break;
      }
    }

    return lastCombination;
  }
}

interface Combination {
  iteration: number;
  value: string;
  parsedValue: string;
  isEqual: boolean;
  started: number;
  ended: number;
  durationSec: number;
  fromFile: boolean;
}
