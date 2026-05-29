import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Disable picocolors so the captured table doesn't contain SGR escape codes.
process.env.NO_COLOR = "1";

describe("runProjectLs human output", () => {
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
              customId: "should-not-appear",
              name: "my-band",
              role: "owner",
            },
            {
              id: "ab123456-0000-0000-0000-000000000000",
              customId: null,
              name: "side-project",
              role: "member",
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;
  }

  it("table has id (8-char prefix), name, role and NO customId column", async () => {
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

    const mod = await import("../commands/project.js");
    await mod.runProjectLs({});

    const out = logs.join("\n");
    // Header row contains id/name/role but NOT customId.
    expect(out).toMatch(/\bid\b/);
    expect(out).toMatch(/\bname\b/);
    expect(out).toMatch(/\brole\b/);
    expect(out).not.toMatch(/customId/);
    expect(out).not.toMatch(/should-not-appear/);
    // Active marker still appears.
    expect(out).toMatch(/\*/);
    // The id column is truncated to the 8-char prefix; the full UUID
    // (with hyphenated tail) must not appear.
    expect(out).toContain("cd5e1b2a");
    expect(out).not.toContain("cd5e1b2a-1111-2222-3333-444455556666");
  });

  it("--json output is unchanged (includes full id and customId)", async () => {
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

    const mod = await import("../commands/project.js");
    await mod.runProjectLs({ json: true });

    expect(logs.length).toBe(1);
    const parsed = JSON.parse(logs[0]!);
    expect(Array.isArray(parsed.projects)).toBe(true);
    expect(parsed.projects[0]).toMatchObject({
      id: "cd5e1b2a-1111-2222-3333-444455556666",
      customId: "should-not-appear",
      name: "my-band",
      role: "owner",
    });
  });
});

// -- runProjectUse: prefix / full UUID / customId resolution (BUG 7 round 2).
describe("runProjectUse resolution", () => {
  let origFetch: typeof globalThis.fetch;
  let origExit: typeof process.exit;
  let logs: string[];
  let errs: string[];
  let origLog: typeof console.log;
  let origErr: typeof console.error;

  const PROJECTS = [
    {
      id: "cd5e1b2a-1111-2222-3333-444455556666",
      customId: "my-band",
      name: "My Band",
      role: "owner",
    },
    {
      id: "cd5e9999-aaaa-bbbb-cccc-dddddddddddd",
      customId: null,
      name: "Other Band",
      role: "member",
    },
    {
      id: "ab123456-0000-0000-0000-000000000000",
      customId: "side",
      name: "Side Project",
      role: "member",
    },
  ];

  const savedConfigs: unknown[] = [];

  beforeEach(() => {
    origFetch = globalThis.fetch;
    origExit = process.exit;
    logs = [];
    errs = [];
    origLog = console.log;
    origErr = console.error;
    console.log = ((...args: unknown[]) => {
      logs.push(args.map((a) => String(a)).join(" "));
    }) as typeof console.log;
    console.error = ((...args: unknown[]) => {
      errs.push(args.map((a) => String(a)).join(" "));
    }) as typeof console.error;
    savedConfigs.length = 0;
    vi.resetModules();

    globalThis.fetch = (async (input: unknown) => {
      const url =
        typeof input === "string" ? input : (input as URL).toString();
      if (url.includes("/api/user/me")) {
        return new Response(
          JSON.stringify({
            user: {
              id: "user-1",
              username: "alice",
              email: "alice@example.com",
            },
            projects: PROJECTS,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response("nope", { status: 500 });
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
    process.exit = origExit;
    console.log = origLog;
    console.error = origErr;
    vi.resetModules();
    vi.doUnmock("../config.js");
  });

  function stubConfig() {
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
        saveConfig: vi.fn(async (cfg: unknown) => {
          savedConfigs.push(cfg);
        }),
      };
    });
  }

  it("8-char prefix match → succeeds and persists full id", async () => {
    stubConfig();
    process.exit = ((code?: number) => {
      throw new Error(`process.exit(${code})`);
    }) as typeof process.exit;

    const mod = await import("../commands/project.js");
    await mod.runProjectUse("cd5e1b2a");

    expect(savedConfigs.length).toBe(1);
    const cfg = savedConfigs[0] as {
      activeProject: { id: string; name: string; customId: string | null };
    };
    expect(cfg.activeProject.id).toBe(
      "cd5e1b2a-1111-2222-3333-444455556666",
    );
    expect(cfg.activeProject.name).toBe("My Band");
    expect(cfg.activeProject.customId).toBe("my-band");
    // Printed message includes the 8-char id prefix.
    expect(logs.join("\n")).toMatch(/Active project set to My Band \(cd5e1b2a\)\./);
  });

  it("full UUID match → succeeds", async () => {
    stubConfig();
    process.exit = ((code?: number) => {
      throw new Error(`process.exit(${code})`);
    }) as typeof process.exit;

    const mod = await import("../commands/project.js");
    await mod.runProjectUse("ab123456-0000-0000-0000-000000000000");

    expect(savedConfigs.length).toBe(1);
    const cfg = savedConfigs[0] as {
      activeProject: { id: string; name: string };
    };
    expect(cfg.activeProject.id).toBe("ab123456-0000-0000-0000-000000000000");
    expect(cfg.activeProject.name).toBe("Side Project");
    expect(logs.join("\n")).toMatch(/Active project set to Side Project \(ab123456\)\./);
  });

  it("customId match → succeeds (wins over prefix)", async () => {
    stubConfig();
    process.exit = ((code?: number) => {
      throw new Error(`process.exit(${code})`);
    }) as typeof process.exit;

    const mod = await import("../commands/project.js");
    await mod.runProjectUse("my-band");

    expect(savedConfigs.length).toBe(1);
    const cfg = savedConfigs[0] as {
      activeProject: { id: string; customId: string | null; name: string };
    };
    expect(cfg.activeProject.id).toBe(
      "cd5e1b2a-1111-2222-3333-444455556666",
    );
    expect(cfg.activeProject.customId).toBe("my-band");
    expect(logs.join("\n")).toMatch(/Active project set to My Band \(cd5e1b2a\)\./);
  });

  it("ambiguous prefix → exits 1 with resolveByPrefix's standard error", async () => {
    stubConfig();
    let exitCode: number | undefined;
    process.exit = ((code?: number) => {
      exitCode = code;
      throw new Error(`process.exit(${code})`);
    }) as typeof process.exit;

    const mod = await import("../commands/project.js");
    await mod.runProjectUse("cd5e").catch(() => {});

    expect(exitCode).toBe(1);
    expect(savedConfigs.length).toBe(0);
    expect(errs.join("\n")).toMatch(
      /project prefix "cd5e" is ambiguous \(matches 2\)/,
    );
  });

  it("no match → exits 1 with `No project matches \"<input>\".`", async () => {
    stubConfig();
    let exitCode: number | undefined;
    process.exit = ((code?: number) => {
      exitCode = code;
      throw new Error(`process.exit(${code})`);
    }) as typeof process.exit;

    const mod = await import("../commands/project.js");
    await mod.runProjectUse("ffffffff").catch(() => {});

    expect(exitCode).toBe(1);
    expect(savedConfigs.length).toBe(0);
    expect(errs.join("\n")).toMatch(/No project matches "ffffffff"\./);
  });
});
