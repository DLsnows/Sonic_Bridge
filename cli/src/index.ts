#!/usr/bin/env node
import { Command } from "commander";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { realpathSync } from "node:fs";
import path from "node:path";

import {
  isFirstRun,
  markWelcomeSeen,
} from "./config.js";
import { printWelcomeBanner } from "./commands/welcome.js";
import { runLogin } from "./commands/login.js";
import { runLogout } from "./commands/logout.js";
import { runWhoami } from "./commands/whoami.js";
import { runProjectLs, runProjectUse } from "./commands/project.js";
import {
  runFilesDownload,
  runFilesLs,
  runFilesMv,
  runFilesRm,
  runFilesUpload,
} from "./commands/files.js";
import {
  runFoldersLs,
  runFoldersMkdir,
  runFoldersRm,
} from "./commands/folders.js";
import { runHelp } from "./commands/help.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

function buildProgram(): Command {
  const program = new Command();

  program
    .name("sonicbridge")
    .description("CLI for the Sonic Bridge platform")
    .version(pkg.version);

  // -- auth
  program
    .command("login")
    .description("Authenticate the CLI against a Sonic Bridge instance")
    .option("--base-url <url>", "Base URL (default https://sonicbridge.app)")
    .option("--token <token>", "CLI token (sb_...) — skips the interactive prompt")
    .action(async (opts) => {
      await runLogin({ baseUrl: opts.baseUrl, token: opts.token });
    });

  program
    .command("logout")
    .description("Clear stored credentials")
    .action(async () => {
      await runLogout();
    });

  program
    .command("whoami")
    .description("Print current user and project memberships")
    .option("--json", "Output JSON")
    .action(async (opts) => {
      await runWhoami({ json: Boolean(opts.json) });
    });

  // -- project
  const project = program
    .command("project")
    .description("List or switch the active project");
  project
    .command("ls")
    .description("List accessible projects")
    .option("--json", "Output JSON")
    .action(async (opts) => {
      await runProjectLs({ json: Boolean(opts.json) });
    });
  project
    .command("use <idOrCustomId>")
    .description("Set the active project for subsequent commands")
    .action(async (idOrCustomId: string) => {
      await runProjectUse(idOrCustomId);
    });

  // -- files
  const files = program.command("files").description("Manage project files");
  files
    .command("ls")
    .description("List files in the active project (root or a folder)")
    .option("--folder <id>", "Folder id (root if omitted)")
    .option("--project <p>", "Project id or customId")
    .option("--json", "Output JSON")
    .action(async (opts) => {
      await runFilesLs(opts);
    });
  files
    .command("upload <localPath>")
    .description("Upload a local file")
    .option("--folder <id>", "Destination folder id (root if omitted)")
    .option("--project <p>", "Project id or customId")
    .option("--json", "Output JSON")
    .action(async (localPath: string, opts) => {
      await runFilesUpload(localPath, opts);
    });
  files
    .command("download <fileId>")
    .description("Download a file by id (use --out - to stream to stdout)")
    .option("--out <path>", "Output path, or `-` for stdout")
    .option("--project <p>", "Project id or customId")
    .action(async (fileId: string, opts) => {
      await runFilesDownload(fileId, opts);
    });
  files
    .command("mv <fileId>")
    .description("Move a file to a folder (or `root`)")
    .requiredOption("--to <folderId|root>", "Destination folder id or `root`")
    .option("--project <p>", "Project id or customId")
    .option("--json", "Output JSON")
    .action(async (fileId: string, opts) => {
      await runFilesMv(fileId, opts);
    });
  files
    .command("rm <fileId>")
    .description("Delete a file (prompts for your password)")
    .option("--project <p>", "Project id or customId")
    .action(async (fileId: string, opts) => {
      await runFilesRm(fileId, opts);
    });

  // -- folders
  const folders = program
    .command("folders")
    .description("Manage folders");
  folders
    .command("ls [folderId]")
    .description("List folder tree, or files inside a specific folder")
    .option("--project <p>", "Project id or customId")
    .option("--json", "Output JSON")
    .action(async (folderId: string | undefined, opts) => {
      await runFoldersLs(folderId, opts);
    });
  folders
    .command("mkdir <name>")
    .description("Create a folder")
    .option("--parent <id>", "Parent folder id (root if omitted)")
    .option("--project <p>", "Project id or customId")
    .option("--json", "Output JSON")
    .action(async (name: string, opts) => {
      await runFoldersMkdir(name, opts);
    });
  folders
    .command("rm <folderId>")
    .description("Delete an empty folder (409 if not empty)")
    .option("--project <p>", "Project id or customId")
    .action(async (folderId: string, opts) => {
      await runFoldersRm(folderId, opts);
    });

  // -- help
  program
    .command("help [topic]")
    .description("Rich help text per topic (login, project, files, folders)")
    .action((topic: string | undefined) => {
      runHelp(topic);
    });

  return program;
}

export async function main(argv: string[] = process.argv): Promise<void> {
  // First-run welcome banner. Print before any other output, then drop a
  // sentinel so subsequent invocations don't re-print it (even if the user
  // never logs in).
  if (isFirstRun()) {
    printWelcomeBanner();
    try {
      await markWelcomeSeen();
    } catch {
      // Non-fatal — worst case, banner shows again next run.
    }
  }
  const program = buildProgram();
  await program.parseAsync(argv);
}

// Invoke only when run as a script (not when imported by tests).
// `import.meta.url` is an absolute file:// URL, but `process.argv[1]` can be
// relative (e.g. `./dist/index.js`) or a symlink (e.g. under `npm link`).
// Resolve both sides to real, absolute paths before comparing — otherwise the
// CLI silently exits with code 0 and produces no output.
const invokedAsScript = (() => {
  try {
    if (!process.argv[1]) return false;
    const modulePath = realpathSync(fileURLToPath(import.meta.url));
    const invokedPath = realpathSync(path.resolve(process.argv[1]));
    return modulePath === invokedPath;
  } catch {
    // If either path can't be resolved (e.g. ENOENT on a stale argv[1]),
    // don't run main — let the importer drive.
    return false;
  }
})();

if (invokedAsScript) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}

export { buildProgram };
