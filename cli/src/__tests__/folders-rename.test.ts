import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// -- Commander parsing tests
describe("folders rename commander parsing", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock("../commands/files.js", () => ({
      runFilesLs: vi.fn(),
      runFilesUpload: vi.fn(),
      runFilesDownload: vi.fn(),
      runFilesMv: vi.fn(),
      runFilesRename: vi.fn(),
      runFilesRm: vi.fn(),
    }));
    vi.doMock("../commands/folders.js", () => ({
      runFoldersLs: vi.fn(),
      runFoldersMkdir: vi.fn(),
      runFoldersRename: vi.fn(),
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
  });

  it("parses `folders rename <id> <newName> --project p1`", async () => {
    const foldersMod = await import("../commands/folders.js");
    const { buildProgram } = await import("../index.js");
    const program = buildProgram();
    program.exitOverride();
    await program.parseAsync([
      "node",
      "sonicbridge",
      "folders",
      "rename",
      "abcd1234",
      "Mix Sessions",
      "--project",
      "p1",
    ]);
    const calls = (foldersMod.runFoldersRename as ReturnType<typeof vi.fn>).mock
      .calls;
    expect(calls.length).toBeGreaterThan(0);
    const [folderId, newName, opts] = calls[calls.length - 1]!;
    expect(folderId).toBe("abcd1234");
    expect(newName).toBe("Mix Sessions");
    expect(opts).toMatchObject({ project: "p1" });
  });
});

// -- runFoldersRename end-to-end
describe("runFoldersRename network behaviour", () => {
  let origFetch: typeof globalThis.fetch;
  let origExit: typeof process.exit;

  beforeEach(() => {
    origFetch = globalThis.fetch;
    origExit = process.exit;
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
    process.exit = origExit;
    vi.resetModules();
    vi.doUnmock("../config.js");
  });

  it("resolves prefix and PATCHes /folders/<id> with {name}", async () => {
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

    const FULL_ID = "deadbeef-0000-1111-2222-333344445555";
    const captured: { url: string; init: RequestInit | undefined }[] = [];
    globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
      const url =
        typeof input === "string" ? input : (input as URL).toString();
      captured.push({ url, init });
      const method = init?.method ?? "GET";

      if (url.endsWith("/folders") && method === "GET") {
        return new Response(
          JSON.stringify({
            folders: [
              {
                id: FULL_ID,
                name: "OldName",
                parentId: null,
                projectId: "proj-1",
                createdAt: "2026-05-27T10:00:00.000Z",
                createdBy: "u",
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (method === "PATCH") {
        return new Response(
          JSON.stringify({
            folder: {
              id: FULL_ID,
              name: "Mix Sessions",
              parentId: null,
              projectId: "proj-1",
              createdAt: "2026-05-27T10:00:00.000Z",
              createdBy: "u",
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response("nope", { status: 500 });
    }) as typeof fetch;

    process.exit = ((code?: number) => {
      throw new Error(`process.exit(${code})`);
    }) as typeof process.exit;

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (msg?: unknown) => {
      logs.push(typeof msg === "string" ? msg : String(msg));
    };

    try {
      const real = await import("../commands/folders.js");
      await real.runFoldersRename("deadbeef", "Mix Sessions", {});
    } finally {
      console.log = origLog;
    }

    const patch = captured.find((c) => (c.init?.method ?? "GET") === "PATCH");
    expect(patch).toBeTruthy();
    expect(patch!.url).toContain(`/folders/${FULL_ID}`);
    const body = JSON.parse(patch!.init!.body as string);
    expect(body).toEqual({ name: "Mix Sessions" });

    expect(logs.some((l) => l.includes("Mix Sessions"))).toBe(true);
  });
});
