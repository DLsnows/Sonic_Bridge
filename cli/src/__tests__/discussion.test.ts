import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderThread, type DiscussionPost } from "../commands/discussion.js";

function mkPost(p: Partial<DiscussionPost> & { id: string }): DiscussionPost {
  return {
    projectId: "proj-1",
    userId: "u",
    username: "alice",
    title: "",
    content: "",
    parentId: null,
    isEdited: false,
    isAiGenerated: false,
    createdAt: "2026-05-27T10:00:00.000Z",
    updatedAt: "2026-05-27T10:00:00.000Z",
    ...p,
  };
}

describe("renderThread", () => {
  it("renders a root post with title, [AI] badge, author, and content", () => {
    const root = mkPost({
      id: "00000000-0000-0000-0000-000000000001",
      title: "Mix v2 notes",
      content: "Bumped bass by 1.5 dB.",
      isAiGenerated: true,
      username: "alice",
      createdAt: "2026-05-27T10:00:00.000Z",
    });
    const out = renderThread(root, [root]);
    const lines = out.split("\n");
    expect(lines[0]).toBe(
      "Mix v2 notes [AI] — by alice @ 2026-05-27T10:00:00.000Z",
    );
    expect(lines[1]).toBe("-----");
    expect(lines[2]).toBe("Bumped bass by 1.5 dB.");
    expect(lines[3]).toBe("-----");
  });

  it("indents replies with 4 spaces per depth and shows reply badges", () => {
    const root = mkPost({
      id: "00000000-0000-0000-0000-000000000001",
      title: "Q",
      content: "Question?",
      username: "alice",
    });
    const reply1 = mkPost({
      id: "00000000-0000-0000-0000-0000000000aa",
      parentId: root.id,
      content: "Answer one",
      username: "bob",
      isAiGenerated: true,
      createdAt: "2026-05-27T11:00:00.000Z",
    });
    const reply2 = mkPost({
      id: "00000000-0000-0000-0000-0000000000bb",
      parentId: reply1.id,
      content: "Follow-up",
      username: "carol",
      createdAt: "2026-05-27T12:00:00.000Z",
    });
    const out = renderThread(root, [root, reply1, reply2]);
    const lines = out.split("\n");
    // Expect the depth-0 reply branch.
    const r1Line = lines.find((l) =>
      l.includes("00000000 by bob [AI] @ 2026-05-27T11:00:00.000Z"),
    );
    expect(r1Line).toBeTruthy();
    expect(r1Line!.startsWith("└── ")).toBe(true);
    // The content of r1 should be indented 4 spaces.
    const r1ContentLine = lines.find((l) => l.endsWith("Answer one"));
    expect(r1ContentLine).toBe("    Answer one");
    // r2 lives one level deeper (4 spaces before the └── connector).
    const r2Line = lines.find((l) =>
      l.includes("00000000 by carol @ 2026-05-27T12:00:00.000Z"),
    );
    expect(r2Line).toBeTruthy();
    expect(r2Line!.startsWith("    └── ")).toBe(true);
    const r2ContentLine = lines.find((l) => l.endsWith("Follow-up"));
    expect(r2ContentLine).toBe("        Follow-up");
  });

  it("sorts siblings by createdAt", () => {
    const root = mkPost({ id: "r", title: "T", content: "T" });
    const a = mkPost({
      id: "a",
      parentId: "r",
      content: "first",
      createdAt: "2026-05-27T10:00:00.000Z",
    });
    const b = mkPost({
      id: "b",
      parentId: "r",
      content: "second",
      createdAt: "2026-05-27T11:00:00.000Z",
    });
    const out = renderThread(root, [root, b, a]);
    const idxFirst = out.indexOf("first");
    const idxSecond = out.indexOf("second");
    expect(idxFirst).toBeGreaterThan(-1);
    expect(idxSecond).toBeGreaterThan(idxFirst);
  });
});

// -- commander parsing tests
describe("discussion commander parsing", () => {
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

  it("parses `discussion read <postId>`", async () => {
    const disMod = await import("../commands/discussion.js");
    const { buildProgram } = await import("../index.js");
    const program = buildProgram();
    program.exitOverride();
    await program.parseAsync([
      "node",
      "sonicbridge",
      "discussion",
      "read",
      "post-1",
    ]);
    const calls = (disMod.runDiscussionRead as ReturnType<typeof vi.fn>).mock
      .calls;
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[calls.length - 1]![0]).toBe("post-1");
  });

  it("parses `discussion post --title X --content -`", async () => {
    const disMod = await import("../commands/discussion.js");
    const { buildProgram } = await import("../index.js");
    const program = buildProgram();
    program.exitOverride();
    await program.parseAsync([
      "node",
      "sonicbridge",
      "discussion",
      "post",
      "--title",
      "X",
      "--content",
      "-",
    ]);
    const calls = (disMod.runDiscussionPost as ReturnType<typeof vi.fn>).mock
      .calls;
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[calls.length - 1]![0]).toMatchObject({
      title: "X",
      content: "-",
    });
  });

  it("parses `discussion reply <postId> --content hello`", async () => {
    const disMod = await import("../commands/discussion.js");
    const { buildProgram } = await import("../index.js");
    const program = buildProgram();
    program.exitOverride();
    await program.parseAsync([
      "node",
      "sonicbridge",
      "discussion",
      "reply",
      "post-1",
      "--content",
      "hello",
    ]);
    const calls = (disMod.runDiscussionReply as ReturnType<typeof vi.fn>).mock
      .calls;
    expect(calls.length).toBeGreaterThan(0);
    const [postId, opts] = calls[calls.length - 1]!;
    expect(postId).toBe("post-1");
    expect(opts).toMatchObject({ content: "hello" });
  });
});

// -- discussion post --content - reads from stdin
describe("runDiscussionPost --content -", () => {
  let origFetch: typeof globalThis.fetch;
  let origExit: typeof process.exit;
  let origStdinIsTTY: boolean | undefined;

  beforeEach(() => {
    origFetch = globalThis.fetch;
    origExit = process.exit;
    origStdinIsTTY = process.stdin.isTTY;
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
    process.exit = origExit;
    // Restore the stdin.isTTY flag.
    Object.defineProperty(process.stdin, "isTTY", {
      value: origStdinIsTTY,
      configurable: true,
    });
    vi.resetModules();
    vi.doUnmock("../config.js");
  });

  it("reads the body from stdin when --content is '-' and posts it", async () => {
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

    // Mock stdin to look non-TTY and yield "hello from stdin" as a single chunk.
    Object.defineProperty(process.stdin, "isTTY", {
      value: false,
      configurable: true,
    });
    const fakeStdin = {
      async *[Symbol.asyncIterator]() {
        yield Buffer.from("hello from stdin");
      },
    };
    // The implementation uses `for await (const chunk of process.stdin)`,
    // so as long as Symbol.asyncIterator on process.stdin yields our chunk
    // we're good. We can't easily replace process.stdin wholesale, but we
    // can stub the asyncIterator symbol.
    (
      process.stdin as unknown as { [Symbol.asyncIterator]: typeof fakeStdin[typeof Symbol.asyncIterator] }
    )[Symbol.asyncIterator] = fakeStdin[Symbol.asyncIterator].bind(fakeStdin);

    let captured: { url: string; body: string | null; method: string } | null =
      null;
    globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
      const url =
        typeof input === "string" ? input : (input as URL).toString();
      captured = {
        url,
        body:
          typeof init?.body === "string"
            ? init.body
            : init?.body
              ? String(init.body)
              : null,
        method: init?.method ?? "GET",
      };
      return new Response(
        JSON.stringify({
          id: "new-post-id",
          projectId: "proj-1",
          userId: "u",
          username: "alice",
          title: "X",
          content: "hello from stdin",
          parentId: null,
          isEdited: false,
          isAiGenerated: true,
          createdAt: "2026-05-27T10:00:00.000Z",
          updatedAt: "2026-05-27T10:00:00.000Z",
        }),
        {
          status: 201,
          headers: { "content-type": "application/json" },
        },
      );
    }) as typeof fetch;

    process.exit = ((code?: number) => {
      throw new Error(`process.exit(${code})`);
    }) as typeof process.exit;

    const disReal = await import("../commands/discussion.js");
    // Silence console output during the run.
    const origLog = console.log;
    console.log = () => {};
    try {
      await disReal.runDiscussionPost({ title: "X", content: "-" });
    } finally {
      console.log = origLog;
    }

    expect(captured).not.toBeNull();
    expect(captured!.method).toBe("POST");
    expect(captured!.url).toContain("/discussion");
    const sentBody = JSON.parse(captured!.body!);
    expect(sentBody).toMatchObject({
      hasParent: false,
      title: "X",
      content: "hello from stdin",
    });
  });
});
