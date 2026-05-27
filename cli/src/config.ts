import { promises as fs } from "node:fs";
import { existsSync } from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

export interface ActiveProject {
  id: string;
  customId?: string | null;
  name?: string;
}

export interface CliConfig {
  baseUrl?: string;
  token?: string;
  activeProject?: ActiveProject;
}

/**
 * Returns the OS-conventional config directory for the CLI.
 * - Windows: %APPDATA%/sonicbridge
 * - POSIX:   $XDG_CONFIG_HOME/sonicbridge or ~/.config/sonicbridge
 */
export function getConfigDir(): string {
  if (process.platform === "win32") {
    const appData =
      process.env.APPDATA ??
      path.join(os.homedir(), "AppData", "Roaming");
    return path.join(appData, "sonicbridge");
  }
  const xdg = process.env.XDG_CONFIG_HOME;
  const base = xdg && xdg.length > 0 ? xdg : path.join(os.homedir(), ".config");
  return path.join(base, "sonicbridge");
}

export function getConfigPath(): string {
  return path.join(getConfigDir(), "config.json");
}

export function getWelcomeSentinelPath(): string {
  return path.join(getConfigDir(), ".welcomed");
}

/** True when the config file does not yet exist. */
export function isFirstRun(): boolean {
  return !existsSync(getConfigPath()) && !existsSync(getWelcomeSentinelPath());
}

/** Returns the parsed config, or null if the file doesn't exist / is unparseable. */
export async function loadConfig(): Promise<CliConfig | null> {
  const p = getConfigPath();
  try {
    const raw = await fs.readFile(p, "utf8");
    const parsed = JSON.parse(raw) as CliConfig;
    return parsed;
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") return null;
    // Corrupt JSON or unreadable file — surface a warning so the user knows
    // their settings aren't being honored, then fall back to a fresh config.
    const msg = e.message ?? String(err);
    process.stderr.write(
      `sonicbridge: warning — could not parse config at ${p}: ${msg}\n`,
    );
    return null;
  }
}

/** Writes the config atomically and chmod 0600 on POSIX. */
export async function saveConfig(cfg: CliConfig): Promise<void> {
  const dir = getConfigDir();
  const p = getConfigPath();
  await fs.mkdir(dir, { recursive: true });
  const tmp = `${p}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(cfg, null, 2), { encoding: "utf8" });
  if (process.platform !== "win32") {
    await fs.chmod(tmp, 0o600);
  }
  await fs.rename(tmp, p);
}

/** Removes the config file. Idempotent. */
export async function clearConfig(): Promise<void> {
  const p = getConfigPath();
  try {
    await fs.unlink(p);
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code !== "ENOENT") throw err;
  }
}

/** Marks the welcome banner as seen even if the user hasn't logged in. */
export async function markWelcomeSeen(): Promise<void> {
  const dir = getConfigDir();
  await fs.mkdir(dir, { recursive: true });
  const sentinel = getWelcomeSentinelPath();
  await fs.writeFile(sentinel, new Date().toISOString(), "utf8");
}

export const DEFAULT_BASE_URL = "https://sonicbridge.app";
