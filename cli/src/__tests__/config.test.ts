import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

let tmpDir: string;
let origHome: string | undefined;
let origAppData: string | undefined;
let origXdg: string | undefined;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "sb-cli-test-"));
  origHome = process.env.HOME;
  origAppData = process.env.APPDATA;
  origXdg = process.env.XDG_CONFIG_HOME;
  process.env.HOME = tmpDir;
  process.env.APPDATA = tmpDir;
  process.env.XDG_CONFIG_HOME = tmpDir;
});

afterEach(async () => {
  if (origHome === undefined) delete process.env.HOME;
  else process.env.HOME = origHome;
  if (origAppData === undefined) delete process.env.APPDATA;
  else process.env.APPDATA = origAppData;
  if (origXdg === undefined) delete process.env.XDG_CONFIG_HOME;
  else process.env.XDG_CONFIG_HOME = origXdg;
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("config", () => {
  it("round-trips write and read", async () => {
    // Import after env vars are patched so getConfigDir picks them up.
    const mod = await import("../config.js");
    expect(mod.isFirstRun()).toBe(true);
    const before = await mod.loadConfig();
    expect(before).toBeNull();

    await mod.saveConfig({
      baseUrl: "https://example.test",
      token: "sb_testtoken_abc",
      activeProject: { id: "proj-1", customId: "demo", name: "Demo" },
    });

    const cfg = await mod.loadConfig();
    expect(cfg).not.toBeNull();
    expect(cfg!.baseUrl).toBe("https://example.test");
    expect(cfg!.token).toBe("sb_testtoken_abc");
    expect(cfg!.activeProject?.id).toBe("proj-1");
    expect(cfg!.activeProject?.customId).toBe("demo");

    // isFirstRun should now be false (config exists).
    expect(mod.isFirstRun()).toBe(false);
  });

  it("getConfigDir respects platform conventions", async () => {
    const mod = await import("../config.js");
    const dir = mod.getConfigDir();
    expect(dir).toContain("sonicbridge");
    if (process.platform === "win32") {
      expect(dir.toLowerCase()).toContain(tmpDir.toLowerCase());
    } else {
      // XDG_CONFIG_HOME we set to tmpDir
      expect(dir).toContain(tmpDir);
    }
  });

  it("clearConfig removes the file", async () => {
    const mod = await import("../config.js");
    await mod.saveConfig({ baseUrl: "https://x.test", token: "t" });
    await mod.clearConfig();
    expect(await mod.loadConfig()).toBeNull();
  });
});
