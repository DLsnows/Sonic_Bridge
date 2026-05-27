import { describe, expect, it, vi } from "vitest";

// Stub out the modules whose side effects we don't want during parsing.
vi.mock("../commands/files.js", () => ({
  runFilesLs: vi.fn(),
  runFilesUpload: vi.fn(),
  runFilesDownload: vi.fn(),
  runFilesMv: vi.fn(),
  runFilesRm: vi.fn(),
}));
vi.mock("../commands/folders.js", () => ({
  runFoldersLs: vi.fn(),
  runFoldersMkdir: vi.fn(),
  runFoldersRm: vi.fn(),
}));
vi.mock("../commands/login.js", () => ({ runLogin: vi.fn() }));
vi.mock("../commands/logout.js", () => ({ runLogout: vi.fn() }));
vi.mock("../commands/whoami.js", () => ({ runWhoami: vi.fn() }));
vi.mock("../commands/project.js", () => ({
  runProjectLs: vi.fn(),
  runProjectUse: vi.fn(),
}));
vi.mock("../commands/help.js", () => ({ runHelp: vi.fn() }));

describe("commander parsing", () => {
  it("parses `files upload ./x.wav --folder abc`", async () => {
    const filesMod = await import("../commands/files.js");
    const { buildProgram } = await import("../index.js");
    const program = buildProgram();
    program.exitOverride();
    await program.parseAsync([
      "node",
      "sonicbridge",
      "files",
      "upload",
      "./x.wav",
      "--folder",
      "abc",
    ]);
    expect(filesMod.runFilesUpload).toHaveBeenCalledTimes(1);
    const call = (filesMod.runFilesUpload as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(call[0]).toBe("./x.wav");
    expect(call[1]).toMatchObject({ folder: "abc" });
  });

  it("parses `files mv <id> --to root --project p1`", async () => {
    const filesMod = await import("../commands/files.js");
    const { buildProgram } = await import("../index.js");
    const program = buildProgram();
    program.exitOverride();
    await program.parseAsync([
      "node",
      "sonicbridge",
      "files",
      "mv",
      "file-abc",
      "--to",
      "root",
      "--project",
      "p1",
    ]);
    const calls = (filesMod.runFilesMv as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const call = calls[calls.length - 1]!;
    expect(call[0]).toBe("file-abc");
    expect(call[1]).toMatchObject({ to: "root", project: "p1" });
  });

  it("parses `folders mkdir Mixes --parent root-id`", async () => {
    const foldersMod = await import("../commands/folders.js");
    const { buildProgram } = await import("../index.js");
    const program = buildProgram();
    program.exitOverride();
    await program.parseAsync([
      "node",
      "sonicbridge",
      "folders",
      "mkdir",
      "Mixes",
      "--parent",
      "root-id",
    ]);
    const calls = (foldersMod.runFoldersMkdir as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const call = calls[calls.length - 1]!;
    expect(call[0]).toBe("Mixes");
    expect(call[1]).toMatchObject({ parent: "root-id" });
  });
});
