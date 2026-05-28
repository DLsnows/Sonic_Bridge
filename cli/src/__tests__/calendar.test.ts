import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// -- parseDateInput unit tests (no commander, no mocks).
import { parseDateInput } from "../commands/calendar.js";

describe("parseDateInput", () => {
  it("returns a UTC ISO string for a local `YYYY-MM-DD HH:mm` input", () => {
    const iso = parseDateInput("2026-06-01 10:00");
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    // Round-trip: should resolve to the user's local 2026-06-01 10:00.
    const round = new Date(iso);
    expect(round.getFullYear()).toBe(2026);
    expect(round.getMonth()).toBe(5); // June, zero-indexed
    expect(round.getDate()).toBe(1);
    expect(round.getHours()).toBe(10);
    expect(round.getMinutes()).toBe(0);
  });

  it("passes ISO 8601 inputs through (same instant)", () => {
    const iso = parseDateInput("2026-06-01T10:00:00Z");
    expect(new Date(iso).toISOString()).toBe("2026-06-01T10:00:00.000Z");
  });

  it("throws on garbage input", () => {
    expect(() => parseDateInput("not-a-date")).toThrow();
  });

  it("throws on empty input", () => {
    expect(() => parseDateInput("   ")).toThrow();
  });
});

// -- Commander parsing tests (mock all command actions so we don't hit fs/net).
describe("calendar commander parsing", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock("../commands/files.js", () => ({
      runFilesLs: vi.fn(),
      runFilesUpload: vi.fn(),
      runFilesDownload: vi.fn(),
      runFilesMv: vi.fn(),
      runFilesRm: vi.fn(),
    }));
    vi.doMock("../commands/folders.js", () => ({
      runFoldersLs: vi.fn(),
      runFoldersMkdir: vi.fn(),
      runFoldersRm: vi.fn(),
    }));
    vi.doMock("../commands/login.js", () => ({ runLogin: vi.fn() }));
    vi.doMock("../commands/logout.js", () => ({ runLogout: vi.fn() }));
    vi.doMock("../commands/whoami.js", () => ({ runWhoami: vi.fn() }));
    vi.doMock("../commands/project.js", () => ({
      runProjectLs: vi.fn(),
      runProjectUse: vi.fn(),
    }));
    vi.doMock("../commands/help.js", () => ({ runHelp: vi.fn() }));
    vi.doMock("../commands/calendar.js", () => ({
      runCalendarAdd: vi.fn(),
      runCalendarLs: vi.fn(),
      runCalendarEdit: vi.fn(),
      runCalendarRm: vi.fn(),
      CALENDAR_HELP: { name: "calendar", summary: "", body: "" },
    }));
    vi.doMock("../commands/discussion.js", () => ({
      runDiscussionLs: vi.fn(),
      runDiscussionRead: vi.fn(),
      runDiscussionPost: vi.fn(),
      runDiscussionReply: vi.fn(),
      DISCUSSION_HELP: { name: "discussion", summary: "", body: "" },
    }));
  });

  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("parses `calendar add --title X --start <local> --end <local>`", async () => {
    const calMod = await import("../commands/calendar.js");
    const { buildProgram } = await import("../index.js");
    const program = buildProgram();
    program.exitOverride();
    await program.parseAsync([
      "node",
      "sonicbridge",
      "calendar",
      "add",
      "--title",
      "X",
      "--start",
      "2026-06-01 10:00",
      "--end",
      "2026-06-01 11:00",
    ]);
    const calls = (calMod.runCalendarAdd as ReturnType<typeof vi.fn>).mock
      .calls;
    expect(calls.length).toBeGreaterThan(0);
    const opts = calls[calls.length - 1]![0];
    expect(opts).toMatchObject({
      title: "X",
      start: "2026-06-01 10:00",
      end: "2026-06-01 11:00",
      // Commander applies the default `other` when no --type is passed.
      type: "other",
    });
  });

  it("parses `calendar ls --from <iso> --to <iso> --project p1`", async () => {
    const calMod = await import("../commands/calendar.js");
    const { buildProgram } = await import("../index.js");
    const program = buildProgram();
    program.exitOverride();
    await program.parseAsync([
      "node",
      "sonicbridge",
      "calendar",
      "ls",
      "--from",
      "2026-06-01T00:00:00Z",
      "--to",
      "2026-06-30T23:59:59Z",
      "--project",
      "p1",
    ]);
    const calls = (calMod.runCalendarLs as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const opts = calls[calls.length - 1]![0];
    expect(opts).toMatchObject({
      from: "2026-06-01T00:00:00Z",
      to: "2026-06-30T23:59:59Z",
      project: "p1",
    });
  });

  it("parses `calendar edit <eventId> --title Y`", async () => {
    const calMod = await import("../commands/calendar.js");
    const { buildProgram } = await import("../index.js");
    const program = buildProgram();
    program.exitOverride();
    await program.parseAsync([
      "node",
      "sonicbridge",
      "calendar",
      "edit",
      "evt-1",
      "--title",
      "Y",
    ]);
    const calls = (calMod.runCalendarEdit as ReturnType<typeof vi.fn>).mock
      .calls;
    expect(calls.length).toBeGreaterThan(0);
    const [eventId, opts] = calls[calls.length - 1]!;
    expect(eventId).toBe("evt-1");
    expect(opts).toMatchObject({ title: "Y" });
  });

  it("parses `calendar rm <eventId>`", async () => {
    const calMod = await import("../commands/calendar.js");
    const { buildProgram } = await import("../index.js");
    const program = buildProgram();
    program.exitOverride();
    await program.parseAsync([
      "node",
      "sonicbridge",
      "calendar",
      "rm",
      "evt-9",
    ]);
    const calls = (calMod.runCalendarRm as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[calls.length - 1]![0]).toBe("evt-9");
  });
});

// -- `calendar ls` default window unit test (real implementation, mocked fetch).
describe("runCalendarLs default --from/--to span 30 days", () => {
  let origFetch: typeof globalThis.fetch;
  let origExit: typeof process.exit;
  let origStderr: typeof process.stderr.write;
  let origConfigDir: string | undefined;

  beforeEach(() => {
    origFetch = globalThis.fetch;
    origExit = process.exit;
    origStderr = process.stderr.write;
    origConfigDir = process.env.XDG_CONFIG_HOME;
    // Force loadConfig to return null so we can't accidentally pick up a real
    // user config; we'll override `apiFetch` by mocking `fetch` + passing
    // --project + setting baseUrl via env if needed. Simpler: stub the
    // config module directly.
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
    process.exit = origExit;
    process.stderr.write = origStderr;
    if (origConfigDir === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = origConfigDir;
    vi.resetModules();
    vi.doUnmock("../config.js");
  });

  it("issues a GET with startDate/endDate ~30d apart, anchored on now", async () => {
    vi.resetModules();
    vi.doMock("../config.js", async () => {
      const actual = await vi.importActual<typeof import("../config.js")>(
        "../config.js",
      );
      return {
        ...actual,
        loadConfig: vi.fn(async () => ({
          baseUrl: "https://test.local",
          token: "sb_t",
          activeProject: { id: "proj-1" },
        })),
      };
    });

    const captured: string[] = [];
    globalThis.fetch = (async (input: unknown) => {
      const url =
        typeof input === "string" ? input : (input as URL).toString();
      captured.push(url);
      return new Response(JSON.stringify({ events: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    // Prevent process.exit from killing the test runner.
    process.exit = ((code?: number) => {
      throw new Error(`process.exit(${code})`);
    }) as typeof process.exit;

    const calReal = await import("../commands/calendar.js");
    const before = Date.now();
    await calReal.runCalendarLs({}).catch(() => {
      // ignore — we only care about the fetch URL that was issued.
    });
    const after = Date.now();

    expect(captured.length).toBeGreaterThan(0);
    const url = new URL(captured[0]!);
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");
    expect(startDate).toBeTruthy();
    expect(endDate).toBeTruthy();
    const startMs = new Date(startDate!).getTime();
    const endMs = new Date(endDate!).getTime();
    const span = endMs - startMs;
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    expect(Math.abs(span - THIRTY_DAYS)).toBeLessThan(5_000);
    expect(startMs).toBeGreaterThanOrEqual(before - 5_000);
    expect(startMs).toBeLessThanOrEqual(after + 5_000);
  });
});
