import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// picocolors detects NO_COLOR at module load time, so we set it before
// importing the command module. As a belt-and-suspenders we also strip any
// SGR escape sequences from captured output.
process.env.NO_COLOR = "1";

// eslint-disable-next-line no-control-regex
const ANSI_RE = /\[[0-9;]*m/g;
function strip(s: string): string {
  return s.replace(ANSI_RE, "");
}

describe("runWhoami human output", () => {
  let origFetch: typeof globalThis.fetch;
  let origExit: typeof process.exit;
  let logs: string[];
  let origLog: typeof console.log;

  beforeEach(() => {
    origFetch = globalThis.fetch;
    origExit = process.exit;
    logs = [];
    origLog = console.log;
    console.log = ((...args: unknown[]) => {
      logs.push(args.map((a) => String(a)).join(" "));
    }) as typeof console.log;
    vi.resetModules();
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
    process.exit = origExit;
    console.log = origLog;
    vi.resetModules();
    vi.doUnmock("../config.js");
  });

  function mockMeResponse() {
    globalThis.fetch = (async () => {
      return new Response(
        JSON.stringify({
          user: {
            id: "user-1",
            username: "alice",
            email: "alice@example.com",
          },
          projects: [
            {
              id: "cd5e1b2a-1111-2222-3333-444455556666",
              customId: null,
              name: "my-band",
              role: "owner",
            },
            {
              id: "ab123456-0000-0000-0000-000000000000",
              customId: "other",
              name: "side-project",
              role: "member",
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;
  }

  it("prints a 3-line human output with active project and pointer", async () => {
    vi.doMock("../config.js", async () => {
      const actual = await vi.importActual<typeof import("../config.js")>(
        "../config.js",
      );
      return {
        ...actual,
        loadConfig: vi.fn(async () => ({
          baseUrl: "https://test.local",
          token: "sb_t",
          activeProject: {
            id: "cd5e1b2a-1111-2222-3333-444455556666",
            name: "my-band",
          },
        })),
      };
    });
    mockMeResponse();

    const mod = await import("../commands/whoami.js");
    await mod.runWhoami({});

    const stripped = logs.map(strip);
    expect(stripped.length).toBe(3);
    expect(stripped[0]).toBe("Logged in as alice (alice@example.com)");
    expect(stripped[1]).toBe("Active project: my-band (cd5e1b2a)");
    expect(stripped[2]).toBe(
      "Run `sonicbridge project ls` to see your projects.",
    );
    // The old projects table must NOT appear in the human output.
    const joined = stripped.join("\n");
    expect(joined).not.toMatch(/customId/);
    expect(joined).not.toMatch(/side-project/);
  });

  it("prints a 2-line human output when no active project is set", async () => {
    vi.doMock("../config.js", async () => {
      const actual = await vi.importActual<typeof import("../config.js")>(
        "../config.js",
      );
      return {
        ...actual,
        loadConfig: vi.fn(async () => ({
          baseUrl: "https://test.local",
          token: "sb_t",
        })),
      };
    });
    mockMeResponse();

    const mod = await import("../commands/whoami.js");
    await mod.runWhoami({});

    const stripped = logs.map(strip);
    expect(stripped.length).toBe(2);
    expect(stripped[0]).toBe("Logged in as alice (alice@example.com)");
    expect(stripped[1]).toBe(
      "Run `sonicbridge project ls` to see your projects.",
    );
  });

  it("--json output still contains user, projects[], and activeProject", async () => {
    vi.doMock("../config.js", async () => {
      const actual = await vi.importActual<typeof import("../config.js")>(
        "../config.js",
      );
      return {
        ...actual,
        loadConfig: vi.fn(async () => ({
          baseUrl: "https://test.local",
          token: "sb_t",
          activeProject: {
            id: "cd5e1b2a-1111-2222-3333-444455556666",
            name: "my-band",
          },
        })),
      };
    });
    mockMeResponse();

    const mod = await import("../commands/whoami.js");
    await mod.runWhoami({ json: true });

    expect(logs.length).toBe(1);
    const parsed = JSON.parse(logs[0]!);
    expect(parsed.user).toMatchObject({
      username: "alice",
      email: "alice@example.com",
    });
    expect(Array.isArray(parsed.projects)).toBe(true);
    expect(parsed.projects.length).toBe(2);
    expect(parsed.activeProject).toMatchObject({
      id: "cd5e1b2a-1111-2222-3333-444455556666",
      name: "my-band",
    });
  });
});
