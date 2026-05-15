import { mkdirSync } from "node:fs";
import { userInfo } from "node:os";
import { join } from "node:path";

export const getProjectRoot = (): string => join(import.meta.dir, "../..");

export const getDataDir = (): string => {
  if (Bun.env.MKRTC_DATA_DIR) return Bun.env.MKRTC_DATA_DIR;

  const dataHome =
    Bun.env.XDG_DATA_HOME ?? join(userInfo().homedir, ".local", "share");

  return join(dataHome, "mkrtc");
};

export const ensureDataDir = (): string => {
  const dataDir = getDataDir();
  mkdirSync(dataDir, { recursive: true });
  return dataDir;
};

export const getDbPath = (): string =>
  Bun.env.MKRTC_DB_PATH ?? join(ensureDataDir(), "db.sqlite");

export const getMigrationsPath = (): string =>
  join(getProjectRoot(), "db", "migrations");
