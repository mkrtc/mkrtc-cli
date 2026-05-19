import type { Command } from "commander";
import consola from "consola";
import ora from "ora";
import { once } from "node:events";
import { createWriteStream, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Charset } from "../constants/str";
import type { IProgram } from "../constants/types";
import { Inject } from "../decorators/inject.decorator";
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
  wifiCapture?: string;
  wifiEssid?: string;
  wifiBssid?: string;
  startAt?: string;
  maxCandidates?: string;
  batchSize?: string;
  onlyCheckInList: boolean;
}

export const BruteForceProgramKey = "program.brute_force";

export class BruteForceProgram implements IProgram {
  @Inject(SystemProviderKey)
  private readonly system: SystemProvider;

  register(command: Command): void {
    command
      .command("bf")
      .option("-v, --value <string>")
      .option("-l, --len <number>", "Password length")
      .option("-s, --symbols <...string>", "Type", "0-9")
      .option("--wifi", "Brute force wifi connection")
      .option("--wifi-capture <path>", "WPA/WPA2 handshake pcap file")
      .option("--wifi-essid <ssid>", "WPA/WPA2 network SSID")
      .option("--wifi-bssid <bssid>", "WPA/WPA2 access point BSSID")
      .option("--start-at <value>", "Start Wi-Fi brute-force from this candidate")
      .option("--max-candidates <number>", "Maximum Wi-Fi candidates to check")
      .option("--batch-size <number>", "Wi-Fi candidates per temporary wordlist", "50000")
      .option("--only-check-in-list", "", false)
      .action((args) => this.action(args));
  }

  private async action(args: BruteForceArgs): Promise<void> {
    const chars = this.parseCharset(args.symbols);

    if (args.wifiCapture) {
      await this.bruteForceWifiHandshake(args, chars);
      return;
    }

    await this.parse(
      chars,
      args.len ? +args.len : args.value?.length || 0,
      args.value || "",
      args.onlyCheckInList,
    );
  }

  private async bruteForceWifiHandshake(
    args: BruteForceArgs,
    chars: string[],
  ): Promise<WifiBruteForceResult | null> {
    if (!args.len) return errorAndExit("--len is required");
    if (!args.wifiEssid) return errorAndExit("--wifi-essid is required");
    if (!args.wifiBssid) return errorAndExit("--wifi-bssid is required");
    if (!args.wifiCapture) return errorAndExit("--wifi-capture is required");
    if (!existsSync(args.wifiCapture))
      return errorAndExit(`Capture file not found: ${args.wifiCapture}`);
    if (!chars.length) return errorAndExit("Charset is empty");

    const aircrackExists = await this.commandExists("aircrack-ng");
    if (!aircrackExists)
      return errorAndExit("aircrack-ng is not installed or not in PATH");

    const len = +args.len;
    if (!Number.isSafeInteger(len) || len <= 0)
      return errorAndExit("--len must be a positive integer");

    const keyspaceSize = chars.length ** len;
    if (!Number.isSafeInteger(keyspaceSize))
      return errorAndExit("Keyspace is too large for this simple mode");

    const startIndex = args.startAt
      ? this.candidateToIndex(args.startAt, chars, len)
      : 0;
    if (startIndex >= keyspaceSize)
      return errorAndExit("--start-at is outside the selected keyspace");

    const remainingCandidates = keyspaceSize - startIndex;
    const maxCandidates = args.maxCandidates
      ? +args.maxCandidates
      : Math.min(remainingCandidates, 100_000_000);
    if (!Number.isSafeInteger(maxCandidates) || maxCandidates <= 0)
      return errorAndExit("--max-candidates must be a positive integer");

    const candidatesToCheck = Math.min(remainingCandidates, maxCandidates);
    const batchSize = args.batchSize ? +args.batchSize : 1_000_000;
    if (!Number.isSafeInteger(batchSize) || batchSize <= 0)
      return errorAndExit("--batch-size must be a positive integer");

    const effectiveBatchSize = Math.min(batchSize, candidatesToCheck);
    const estimatedMb = (effectiveBatchSize * (len + 1)) / 1024 / 1024;
    consola.info(
      `Search window: start=${this.indexToCandidate(startIndex, chars, len)}, ` +
        `candidates=${candidatesToCheck}, batch=${effectiveBatchSize}`,
    );
    consola.info(`Temporary wordlist estimate per batch: ${estimatedMb.toFixed(2)} MB`);

    const tmpPath = mkdtempSync(join(tmpdir(), "mkrtc-wifi-bf-"));
    const wordlistPath = join(tmpPath, "candidates.txt");
    let cancelled = false;
    let proc: ReturnType<SystemProvider["cmd"]> | null = null;
    let cleaned = false;
    const stdin = process.stdin;

    const started = Date.now();
    const spinner = ora().start(
      `Generating candidates`,
    );
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      process.off("SIGINT", cancel);
      process.off("SIGTERM", cancel);
      process.off("SIGHUP", cancel);
      process.off("SIGQUIT", cancel);
      stdin.off("data", onStdinData);
      rmSync(tmpPath, { recursive: true, force: true });
    };
    const cancel = () => {
      if (cancelled) return;
      cancelled = true;
      this.stopProcess(proc);
      spinner.warn("Cancelled");
      cleanup();
      process.exit(130);
    };
    const onStdinData = (chunk: Buffer) => {
      if (chunk.includes(3)) cancel();
    };
    process.on("SIGINT", cancel);
    process.on("SIGTERM", cancel);
    process.on("SIGHUP", cancel);
    process.on("SIGQUIT", cancel);
    stdin.on("data", onStdinData);

    try {
      let checked = 0;
      let lastOutput = "";
      let lastCode = 0;

      while (checked < candidatesToCheck) {
        const batchStartIndex = startIndex + checked;
        const currentBatchSize = Math.min(batchSize, candidatesToCheck - checked);
        const batchEndIndex = batchStartIndex + currentBatchSize - 1;

        await this.writeCandidatesToFile(
          wordlistPath,
          chars,
          len,
          batchStartIndex,
          currentBatchSize,
          () => cancelled,
          (iteration, candidate) => {
            if (iteration % 1000 !== 0) return;
            const elapsedSec = (Date.now() - started) / 1000;
            spinner.text =
              `generating ${checked + iteration}/${candidatesToCheck}: ${candidate}; ` +
              `elapsed ${elapsedSec.toFixed(2)}s`;
          },
        );

        if (cancelled) {
          spinner.warn("Cancelled");
          return null;
        }

        spinner.text =
          `checking ${checked + currentBatchSize}/${candidatesToCheck}: ` +
          `${this.indexToCandidate(batchStartIndex, chars, len)}..` +
          `${this.indexToCandidate(batchEndIndex, chars, len)}`;

        const aircrackStarted = Date.now();
        proc = this.system.cmd(
          [
            "aircrack-ng",
            "-q",
            "-a2",
            "-b",
            args.wifiBssid,
            "-e",
            args.wifiEssid,
            "-w",
            wordlistPath,
            args.wifiCapture,
          ],
          { mode: { stdout: "pipe", stderr: "pipe" } },
        );

        const output = await this.collectProcessOutput(proc);
        const code = await proc.exited;
        const ended = Date.now();
        const durationSec = (ended - started) / 1000;
        const aircrackDurationSec = (ended - aircrackStarted) / 1000;
        lastOutput = output;
        lastCode = code;

        if (cancelled) {
          spinner.warn("Cancelled");
          return null;
        }

        const key = this.parseAircrackKey(output);
        if (key) {
          spinner.succeed(
            `WiFi password found: ${key}. Duration: ${durationSec.toFixed(2)} sec.`,
          );
          return {
            isFound: true,
            key,
            started,
            ended,
            durationSec,
            aircrackExitCode: code,
          };
        }

        checked += currentBatchSize;
        spinner.text =
          `batch done in ${aircrackDurationSec.toFixed(2)}s; ` +
          `checked ${checked}/${candidatesToCheck}`;
      }

      const ended = Date.now();
      const durationSec = (ended - started) / 1000;
      spinner.fail(
        `Password was not found in ${candidatesToCheck} candidates. ` +
          `Duration: ${durationSec.toFixed(2)} sec.`,
      );
      consola.info(lastOutput.trim());
      return {
        isFound: false,
        started,
        ended,
        durationSec,
        aircrackExitCode: lastCode,
      };
    } catch (error) {
      if (cancelled) {
        spinner.warn("Cancelled");
        return null;
      }
      throw error;
    } finally {
      cleanup();
    }
  }

  private stopProcess(proc: ReturnType<SystemProvider["cmd"]> | null): void {
    if (!proc) return;

    for (const signal of ["SIGTERM", "SIGKILL"] as const) {
      try {
        process.kill(-proc.pid, signal);
      } catch {
        proc.kill(signal);
      }
    }
  }

  private async commandExists(command: string): Promise<boolean> {
    const proc = this.system.cmd(["which", command], { mode: "pipe" });
    return (await proc.exited) === 0;
  }

  private async collectProcessOutput(
    proc: Bun.Subprocess<"pipe", "pipe", "pipe">,
  ): Promise<string> {
    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);
    return `${stdout}\n${stderr}`;
  }

  private async writeCandidatesToFile(
    filePath: string,
    chars: string[],
    len: number,
    startIndex: number,
    count: number,
    shouldStop: () => boolean,
    onProgress: (iteration: number, candidate: string) => void,
  ): Promise<void> {
    const stream = createWriteStream(filePath, { encoding: "utf8" });
    const errorPromise = new Promise<never>((_, reject) => {
      stream.once("error", reject);
    });

    try {
      for (let iteration = 0; iteration < count; iteration++) {
        if (shouldStop()) return;

        const candidate = this.indexToCandidate(startIndex + iteration, chars, len);
        onProgress(iteration, candidate);

        const canContinue = stream.write(`${candidate}\n`);
        if (!canContinue) {
          await Promise.race([once(stream, "drain"), errorPromise]);
        }

        if (iteration % 1_000 === 0) {
          await new Promise<void>((resolve) => setTimeout(resolve, 0));
        }
      }

      stream.end();
      await Promise.race([once(stream, "finish"), errorPromise]);
    } finally {
      if (!stream.closed) stream.destroy();
    }
  }

  private indexToCandidate(index: number, chars: string[], len: number): string {
    let n = index;
    let out = "";

    for (let j = 0; j < len; j++) {
      out = chars[n % chars.length] + out;
      n = Math.floor(n / chars.length);
    }

    return out;
  }

  private candidateToIndex(candidate: string, chars: string[], len: number): number {
    const normalized = candidate.padStart(len, chars[0]);
    if (normalized.length !== len)
      return errorAndExit(`--start-at must be ${len} characters or fewer`);

    const charIndexes = new Map(chars.map((char, index) => [char, index]));
    let index = 0;
    for (const char of normalized) {
      const charIndex = charIndexes.get(char);
      if (charIndex === undefined)
        return errorAndExit(`--start-at contains a character outside charset: ${char}`);
      index = index * chars.length + charIndex;
    }

    return index;
  }

  private parseAircrackKey(output: string): string | null {
    const match = output.match(/KEY FOUND!\s*\[\s*([^\]]+?)\s*\]/);
    return match?.[1] ?? null;
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

  private async parse(
    chars: string[],
    len: number,
    value: string,
    onlyList: boolean = false,
  ): Promise<Combination> {
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

    if (onlyList) return lastCombination;
    const spinner = ora().start("Running brute force for: " + value);

    for (let i = 0; i < combinations; i++) {
      if (i % 1000 === 0) {
        await Bun.sleep(0);
      }
      let n = i;
      let out = "";

      for (let j = 0; j < len; j++) {
        out = chars[n % chars.length] + out;
        n = Math.floor(n / chars.length);
      }

      const isEqual = out === value;

      const ended = Date.now();
      const durationSec = (ended - started) / 1000;
      spinner.text = `iteration: ${i}. Checking: ${value} = ${out}. match: ${isEqual ? "yes" : "no"}, duration: ${durationSec.toFixed(2)}s`;

      if (out === value) {
        spinner.succeed(
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

interface WifiBruteForceResult {
  isFound: boolean;
  key?: string;
  started: number;
  ended: number;
  durationSec: number;
  aircrackExitCode: number;
}
