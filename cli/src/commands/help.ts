import pc from "picocolors";
import { CALENDAR_HELP } from "./calendar.js";
import { DISCUSSION_HELP } from "./discussion.js";

interface Topic {
  name: string;
  summary: string;
  body: string;
}

const TOPICS: Record<string, Topic> = {
  login: {
    name: "login",
    summary: "Authenticate the CLI against a Sonic Bridge instance.",
    body: [
      "Usage:",
      "  sonicbridge login",
      "  sonicbridge login --base-url <url>",
      "  SONICBRIDGE_TOKEN=sb_... sonicbridge login --base-url <url>   # CI",
      "",
      "Interactive prompts: base URL (default https://sonicbridge.app) and CLI token.",
      "The CLI verifies the token by calling GET /api/user/me and stores it in the",
      "OS config dir (chmod 0600 on POSIX).",
      "",
      "For unattended / CI use, set SONICBRIDGE_TOKEN in the environment to skip",
      "the prompt. The token is never accepted via argv — it would leak into shell",
      "history and /proc/<pid>/cmdline.",
      "",
      "Generate a token under Project Settings → CLI Access in the web UI.",
    ].join("\n"),
  },
  files: {
    name: "files",
    summary: "List, upload, download, move, rename, and delete project files.",
    body: [
      "Usage:",
      "  sonicbridge files ls [--folder <id>] [--project <p>] [--json]",
      "  sonicbridge files upload <localPath> [--folder <id>] [--project <p>]",
      "  sonicbridge files download <fileId> [--out <path|->] [--project <p>]",
      "  sonicbridge files mv <fileId> --to <folderId|root> [--project <p>]",
      "  sonicbridge files rename <fileId> <newName> [--project <p>] [--json]",
      "  sonicbridge files rm <fileId> [--project <p>]",
      "",
      "`upload` uses the two-step presigned URL flow. Without --folder, the file",
      "uploads to the project root; --folder accepts the same 8-char prefix shown",
      "by `folders ls` or a full UUID. `download --out -` streams to stdout.",
      "`mv --to root` moves the file out of any folder. `rename` keeps the file's",
      "extension; trying to change it returns 422. `rm` prompts for the user's",
      "password and then issues a single-use challenge token.",
    ].join("\n"),
  },
  folders: {
    name: "folders",
    summary: "Browse, create, rename, and remove folders.",
    body: [
      "Usage:",
      "  sonicbridge folders ls [--project <p>] [--json]",
      "  sonicbridge folders ls <folderId> [--project <p>] [--json]",
      "  sonicbridge folders mkdir <name> [--parent <id>] [--project <p>]",
      "  sonicbridge folders rename <folderId> <newName> [--project <p>] [--json]",
      "  sonicbridge folders rm <folderId> [--project <p>]",
      "",
      "`ls` with no argument prints the project's folder tree. `ls <folderId>`",
      "prints the files inside that folder. `rename` changes the folder name",
      "without moving its contents. `rm` refuses non-empty folders with",
      "409 folder_not_empty — clear the contents first.",
    ].join("\n"),
  },
  project: {
    name: "project",
    summary: "List accessible projects and set the active one.",
    body: [
      "Usage:",
      "  sonicbridge project ls [--json]",
      "  sonicbridge project use <idOrCustomId>",
      "",
      "`use` stores the selection in the config so subsequent commands can omit",
      "--project.",
    ].join("\n"),
  },
  calendar: CALENDAR_HELP,
  discussion: DISCUSSION_HELP,
};

const HEADER = [
  "sonicbridge — CLI for the Sonic Bridge platform",
  "",
  "Common commands:",
  "  sonicbridge login                          Authenticate with a CLI token",
  "  sonicbridge logout                         Clear stored credentials",
  "  sonicbridge whoami                         Print current user + project list",
  "  sonicbridge project ls                     List accessible projects",
  "  sonicbridge project use <id>               Set the active project",
  "  sonicbridge files ls|upload|download|mv|rename|rm  Manage project files",
  "  sonicbridge folders ls|mkdir|rename|rm     Manage folders",
  "  sonicbridge calendar add|ls|edit|rm        Manage calendar events",
  "  sonicbridge discussion ls|read|post|reply  Read and post in discussions",
  "  sonicbridge help <topic>                   Detailed help for a topic",
  "",
  "Topics: login, project, files, folders, calendar, discussion",
  "",
  "Pass --help to any subcommand for its full flag list.",
  "",
  "AI agents: full reference (AI-flag rule, JSON shapes, mini patterns, exit codes) at",
  "  https://github.com/DLsnows/Sonic_Bridge/blob/dev/docs/cli/agent-usage.md",
  "Humans: install + token setup at",
  "  https://github.com/DLsnows/Sonic_Bridge/blob/dev/docs/cli/install-for-agents.md",
].join("\n");

export function runHelp(topic: string | undefined): void {
  if (!topic) {
    console.log(HEADER);
    return;
  }
  const t = TOPICS[topic.toLowerCase()];
  if (!t) {
    console.error(pc.red(`Unknown help topic: ${topic}`));
    console.error(`Available topics: ${Object.keys(TOPICS).join(", ")}`);
    process.exit(1);
  }
  console.log(`${pc.bold(t.name)} — ${t.summary}`);
  console.log("");
  console.log(t.body);
}
