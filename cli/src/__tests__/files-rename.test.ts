import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// -- Commander parsing tests (mock all command actions so we don't hit fs/net).
describe("files rename commander parsing", () => {
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

  it("parses `files rename <id> <newName> --project p1`", async () => {
    const filesMod = await import("../commands/files.js");
    const { buildProgram } = await import("../index.js");
    const program = buildProgram();
    program.exitOverride();
    await program.parseAsync([
      "node",
      "sonicbridge",
      "files",
      "rename",
      "abc12345",
      "mix-final.wav",
      "--project",
      "p1",
    ]);
    const calls = (filesMod.runFilesRename as ReturnType<typeof vi.fn>).mock
      .calls;
    expect(calls.length).toBeGreaterThan(0);
    const [fileId, newName, opts] = calls[calls.length - 1]!;
    expect(fileId).toBe("abc12345");
    expect(newName).toBe("mix-final.wav");
    expect(opts).toMatchObject({ project: "p1" });
  });

  it("parses `files rename <id> <newName> --json`", async () => {
    const filesMod = await import("../commands/files.js");
    const { buildProgram } = await import("../index.js");
    const program = buildProgram();
    program.exitOverride();
    await program.parseAsync([
      "node",
      "sonicbridge",
      "files",
      "rename",
      "abc12345",
      "mix-final.wav",
      "--json",
    ]);
    const calls = (filesMod.runFilesRename as ReturnType<typeof vi.fn>).mock
      .calls;
    expect(calls.length).toBeGreaterThan(0);
    const opts = calls[calls.length - 1]![2];
    expect(opts).toMatchObject({ json: true });
  });
});

// -- runFilesRename end-to-end (real impl, mocked fetch + config).
describe("runFilesRename network behaviour", () => {
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
          activeProject: { id: "proj-1" },
        })),
      };
    });
  }

  it("happy path: resolves prefix, PATCHes with {name}, prints success", async () => {
    vi.resetModules();
    stubConfig();

    const FULL_ID = "abcd1234-aaaa-bbbb-cccc-111122223333";
    const captured: { url: string; init: RequestInit | undefined }[] = [];
    globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
      const url =
        typeof input === "string" ? input : (input as URL).toString();
      captured.push({ url, init });
      const method = init?.method ?? "GET";
      // GET /folders → empty (so we walk only the root).
      if (url.endsWith("/folders") && method === "GET") {
        return new Response(JSON.stringify({ folders: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      // GET /files → list with one file.
      if (url.includes("/files") && method === "GET") {
        return new Response(
          JSON.stringify({
            files: [
              {
                id: FULL_ID,
                name: "mix.wav",
                size: 1,
                mimeType: "audio/wav",
                storageKey: "k",
                folderId: null,
                uploadedBy: "u",
                uploaderName: "alice",
                uploadedAt: "2026-05-27T10:00:00.000Z",
              },
            ],
            folderId: null,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      // PATCH /files/<id> → success.
      if (method === "PATCH") {
        return new Response(
          JSON.stringify({
            file: {
              id: FULL_ID,
              name: "mix-final.wav",
              size: 1,
              mimeType: "audio/wav",
              folderId: null,
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
      const realFiles = await import("../commands/files.js");
      await realFiles.runFilesRename("abcd1234", "mix-final.wav", {});
    } finally {
      console.log = origLog;
    }

    // Verify the PATCH was made with the right body.
    const patch = captured.find((c) => (c.init?.method ?? "GET") === "PATCH");
    expect(patch).toBeTruthy();
    expect(patch!.url).toContain(`/files/${FULL_ID}`);
    const body = JSON.parse(patch!.init!.body as string);
    expect(body).toEqual({ name: "mix-final.wav" });

    // And the success line was printed.
    expect(
      logs.some((l) => l.includes("Renamed") && l.includes("mix-final.wav")),
    ).toBe(true);
  });

  it("422 extension_change_not_allowed → friendly error + exit 1", async () => {
    vi.resetModules();
    stubConfig();

    const FULL_ID = "abcd1234-aaaa-bbbb-cccc-111122223333";
    globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
      const url =
        typeof input === "string" ? input : (input as URL).toString();
      const method = init?.method ?? "GET";
      if (url.endsWith("/folders") && method === "GET") {
        return new Response(JSON.stringify({ folders: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.includes("/files") && method === "GET") {
        return new Response(
          JSON.stringify({
            files: [
              {
                id: FULL_ID,
                name: "mix.wav",
                size: 1,
                mimeType: "audio/wav",
                storageKey: "k",
                folderId: null,
                uploadedBy: "u",
                uploaderName: "alice",
                uploadedAt: "2026-05-27T10:00:00.000Z",
              },
            ],
            folderId: null,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (method === "PATCH") {
        return new Response(
          JSON.stringify({
            error: "extension_change_not_allowed",
            currentExt: "wav",
            newExt: "mp3",
          }),
          { status: 422, headers: { "content-type": "application/json" } },
        );
      }
      return new Response("nope", { status: 500 });
    }) as typeof fetch;

    let exitCode: number | undefined;
    process.exit = ((code?: number) => {
      exitCode = code;
      throw new Error(`process.exit(${code})`);
    }) as typeof process.exit;

    const errs: string[] = [];
    const origErr = console.error;
    console.error = (msg?: unknown) => {
      errs.push(typeof msg === "string" ? msg : String(msg));
    };
    const origLog = console.log;
    console.log = () => {};
    // Suppress the yellow warning we emit to stderr for ext mismatch.
    const origStderrWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = (() => true) as typeof process.stderr.write;

    try {
      const realFiles = await import("../commands/files.js");
      await realFiles
        .runFilesRename("abcd1234", "mix.mp3", {})
        .catch(() => {});
    } finally {
      console.error = origErr;
      console.log = origLog;
      process.stderr.write = origStderrWrite;
    }

    expect(exitCode).toBe(1);
    expect(
      errs.some(
        (l) =>
          l.includes("Extension cannot be changed") &&
          l.includes(".wav") &&
          l.includes(".mp3"),
      ),
    ).toBe(true);
  });
});
