export const run = (
  cmd: string,
  args: string[],
  mode: "inherit" | "pipe" = "inherit",
): Bun.Subprocess<"ignore", "inherit", "inherit"> => {
  const proc = Bun.spawn([cmd, ...args], {
    stdout: mode,
    stderr: mode,
  });

  return proc;
};

export const runAsSudo = (
  cmd: string,
  args: string[],
  mode?: "inherit" | "pipe",
): Bun.Subprocess<"ignore", "inherit", "inherit"> =>
  run("sudo", [cmd, ...args], mode);
