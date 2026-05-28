import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

let tmpDir: string;
const origEnv = {
  HOME: process.env.HOME,
  APPDATA: process.env.APPDATA,
  XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME,
};

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "sb-cli-welcome-"));
  process.env.HOME = tmpDir;
  process.env.APPDATA = tmpDir;
  process.env.XDG_CONFIG_HOME = tmpDir;
  vi.resetModules();
});

afterEach(async () => {
  if (origEnv.HOME === undefined) delete process.env.HOME;
  else process.env.HOME = origEnv.HOME;
  if (origEnv.APPDATA === undefined) delete process.env.APPDATA;
  else process.env.APPDATA = origEnv.APPDATA;
  if (origEnv.XDG_CONFIG_HOME === undefined) delete process.env.XDG_CONFIG_HOME;
  else process.env.XDG_CONFIG_HOME = origEnv.XDG_CONFIG_HOME;
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("welcome banner", () => {
  it("is printed only once across two invocations (sentinel-based)", async () => {
    // Capture stdout writes.
    const writes: string[] = [];
    const origWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string | Uint8Array) => {
      writes.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString());
      return true;
    }) as typeof process.stdout.write;

    try {
      const config = await import("../config.js");
      const welcome = await import("../commands/welcome.js");

      // Invocation 1
      expect(config.isFirstRun()).toBe(true);
      welcome.printWelcomeBanner();
      await config.markWelcomeSeen();

      // Invocation 2 (still no config.json, but sentinel exists)
      expect(config.isFirstRun()).toBe(false);

      const bannerHits = writes.filter((w) => w.includes("Welcome to SonicBridge CLI")).length;
      expect(bannerHits).toBe(1);
    } finally {
      process.stdout.write = origWrite;
    }
  });
});
