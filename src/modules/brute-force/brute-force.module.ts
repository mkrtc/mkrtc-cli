import type { Command } from "commander";
import consola from "consola";
import { Charset } from "../../constants/str";
import { error } from "../../utils/error";
import { isSudo } from "../../utils/is-sudo";
import { run, runAsSudo } from "../../utils/run-script";

interface BruteForceArgs {
  value?: string;
  len?: string;
  symbols: string;
  wifi?: boolean;
}

export class BruteForceModule {
  private lastCombinations: Combination;
  static register(command: Command): void {
    command
      .command("bf")
      .option("-v, --value <string>")
      .option("-l, --len <number>", "Password length")
      .option("-s, --symbols <...string>", "Type", "0-9")
      .option("--wifi", "Brute force wifi connection")
      .action((args: BruteForceArgs) => {
        const module = new BruteForceModule();

        return module.action(args);
      });
  }

  private async action(args: BruteForceArgs) {
    const chars = this.parseCharset(args.symbols);
    const combination = this.parse(
      chars,
      args.len ? +args.len : args.value?.length || 0,
      args.value || "",
    );
  }

  private async scanWifi() {
    consola.debug("Detecting sudo mode...");
    const isSudoMode = await isSudo();
    if (!isSudoMode) return error('Please run script as "sudo" mode');

    consola.success("sudo enabled");

    consola.debug("Detecting wifi interface");
    const iface = await this.getWifiInterface();
    if (!iface) return error("WIFI interface not found");
    consola.success(`WIFI interface detected: ${iface}`);

    await runAsSudo("ip", ["link", "set", iface, "down"]).exited;

    consola.debug('Enabling wifi type to: "monitor"');
    // monitor mode
    await runAsSudo("iw", ["dev", iface, "set", "type", "monitor"]).exited;
    const wifiMonitorIsEnabled = await this.monitorIsEnabled(iface);

    // up
    await runAsSudo("ip", ["link", "set", iface, "up"]).exited;

    if (!wifiMonitorIsEnabled)
      return error("Can't enable wifi monitor. Please check your wifi module");

    consola.success("WIFI monitor successfully enabled");

    // capture EAPOL
    const capture = runAsSudo(
      "tcpdump",
      ["-i", iface, "-w", "handshake.pcap"],
      "inherit",
    );

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
    const proc = run("iw", ["dev"], "pipe");

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

  private parse(chars: string[], len: number, value: string): Combination {
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
    };
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
}
