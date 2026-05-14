import { runAsSudo } from "./run-script";

export const isSudo = async (): Promise<boolean> => {
  const proc = runAsSudo("-n", ["true"], "pipe");

  const code = await proc.exited;

  return code === 0;
};
