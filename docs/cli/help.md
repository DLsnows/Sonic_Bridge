# sonicbridge help — Long-form

This document mirrors what `sonicbridge help <topic>` prints. The source of truth is the `*_HELP` blocks colocated with each command in `cli/src/commands/`; this file exists so the same content is browsable without running the CLI.

For a richer agent-oriented reference (including JSON output shapes, mini patterns, and exit codes), see [`agent-usage.md`](./agent-usage.md). For installation steps, see [`install-for-agents.md`](./install-for-agents.md).

## Top-level commands

```
sonicbridge <command> [args] [flags]

  login              Authenticate the CLI against a Sonic Bridge instance
  logout             Clear stored credentials
  whoami             Print current user + project memberships
  project ls         List accessible projects
  project use <id>   Set the active project for subsequent commands
  files ...          Manage project files (ls, upload, download, mv, rename, rm)
  folders ...        Manage folders (ls, mkdir, rename, rm)
  calendar ...       Manage calendar events (add, ls, edit, rm)
  discussion ...     Browse + post to project discussions (ls, read, post, reply)
  help [topic]       Per-topic help (login, project, files, folders, calendar, discussion)
```

Run `sonicbridge --help` (or `sonicbridge <subcommand> --help`) for commander's auto-generated usage on any node.

## Id arguments — prefix or full UUID

Every command that takes an id (file, folder, calendar event, discussion post) accepts either the full UUID or the 8-character prefix shown by `ls`. If the prefix is ambiguous, the CLI fails with `<label> prefix "<input>" is ambiguous (matches N). Use more characters or the full UUID.`

---

## Topic: `login`

Authenticate the CLI against a Sonic Bridge instance.

```
sonicbridge login [--base-url <url>]
```

Flags:

- `--base-url <url>` — base URL of the Sonic Bridge deployment (default `https://sonicbridge.app`)

The token is **never** accepted as a CLI argument. Token source order:

1. `SONICBRIDGE_TOKEN` environment variable (best for CI / unattended agents)
2. Interactive hidden prompt

Generate a token in the web app: **Project Settings → CLI Access → Generate CLI Token**. Tokens are per-user (not per-project) and grant the same permissions as your web session.

Validation: login calls `GET /api/user/me`. On 200 the config is saved; on failure the CLI exits 1.

Examples:

```sh
sonicbridge login
# (paste token at prompt)

SONICBRIDGE_TOKEN=sb_xxx sonicbridge login --base-url https://staging.sonicbridge.app
```

---

## Topic: `project`

List or switch the active project.

```
sonicbridge project ls [--json]
sonicbridge project use <idOrCustomId>
```

`project ls` shows every project your token can access. `project use` persists the active project in the config; subsequent commands can omit `--project`.

Examples:

```sh
sonicbridge project ls
sonicbridge project use my-band
sonicbridge project use cd5e1b2a-...  # UUID also works
```

---

## Topic: `files`

Manage project files.

```
sonicbridge files ls [--folder <id>] [--project <p>] [--json]
sonicbridge files upload <localPath> [--folder <id>] [--project <p>] [--json]
sonicbridge files download <fileId> [--out <path>] [--project <p>]
sonicbridge files mv <fileId> --to <folderId|root> [--project <p>] [--json]
sonicbridge files rename <fileId> <newName> [--project <p>] [--json]
sonicbridge files rm <fileId> [--project <p>]
```

- `files ls` — list files in a folder (or project root if `--folder` omitted).
- `files upload` — two-step presigned upload + register. Progress bar on TTY.
- `files download` — stream a file to disk. `--out -` writes to stdout. The server-supplied filename is sanitized with `path.basename` to prevent traversal.
- `files mv` — change a file's parent folder. `--to root` moves to the project root.
- `files rename` — change a file's name. **Extension must stay the same.** Server returns 422 `extension_change_not_allowed` if the extension differs. Dotfiles (`.gitignore`, `.env`) are treated as no-extension on both sides.
- `files rm` — **destructive.** Pre-flight HEAD short-circuits 404 before prompting for the password. Prompts for your password, mints a short-lived single-use challenge, then deletes. The challenge is only consumed if the file exists, so typoing the id costs nothing. Rate-limited to 5 failed password attempts per 15 minutes.

Every id argument accepts the full UUID or the 8-character prefix shown by `ls`. Ambiguous prefixes fail with a clear error.

Examples:

```sh
sonicbridge files ls
sonicbridge files upload ./mix-v3.wav --folder 4b1c
sonicbridge files download f0d1 --out ./mix.wav
sonicbridge files mv f0d1 --to root
sonicbridge files rename f0d1 mix-final.wav
sonicbridge files rm f0d1   # password prompt
```

---

## Topic: `folders`

Manage folders.

```
sonicbridge folders ls [folderId] [--project <p>] [--json]
sonicbridge folders mkdir <name> [--parent <id>] [--project <p>] [--json]
sonicbridge folders rename <folderId> <newName> [--project <p>] [--json]
sonicbridge folders rm <folderId> [--project <p>]
```

- `folders ls` (no arg) — tree view of every folder in the project.
- `folders ls <folderId>` — list the files inside that folder.
- `folders mkdir <name>` — create a folder. `--parent` to nest.
- `folders rename <folderId> <newName>` — change a folder's name. No extension rule (folders don't have extensions).
- `folders rm <folderId>` — **only succeeds on empty folders.** The server returns 409 `folder_not_empty` otherwise. Empty the folder (move or delete contents) first.

Examples:

```sh
sonicbridge folders ls
sonicbridge folders ls 4b1c...
sonicbridge folders mkdir "Mix Sessions"
sonicbridge folders mkdir "Stems" --parent 4b1c
sonicbridge folders rename 4b1c "Mix Sessions Final"
sonicbridge folders rm 4b1c
```

---

## Topic: `calendar`

Manage project calendar events.

```
sonicbridge calendar add  --title <t> --start <date> --end <date> \
                          [--desc <d>] [--type meeting|production|release|other] \
                          [--project <p>] [--json]
sonicbridge calendar ls   [--from <date>] [--to <date>] [--project <p>] [--json]
sonicbridge calendar edit <eventId> [--title <t>] [--start <date>] [--end <date>] \
                          [--desc <d>] [--type <t>] [--project <p>] [--json]
sonicbridge calendar rm   <eventId> [--project <p>]
```

Dates accept either ISO 8601 (`2026-06-01T10:00:00Z`) or local `YYYY-MM-DD HH:mm` (parsed in the host's local timezone, then sent in UTC).

`calendar ls` defaults to the next 30 days if `--from` / `--to` are omitted.

`edit` and `rm` are gated to the event's creator OR a project admin. A 403 from the server prints "Only the creator or a project admin can edit/delete this event."

Examples:

```sh
sonicbridge calendar add --title "Mix review" \
  --start "2026-06-01 10:00" --end "2026-06-01 11:00" --type meeting
sonicbridge calendar ls --from 2026-06-01 --to 2026-06-30
sonicbridge calendar edit a31f... --start "2026-06-01 10:30"
sonicbridge calendar rm a31f...
```

---

## Topic: `discussion`

Browse + post to project discussion threads.

```
sonicbridge discussion ls    [--project <p>] [--json]
sonicbridge discussion read  <postId> [--project <p>] [--json]
sonicbridge discussion post  --title <t> --content <c|-> [--project <p>] [--json]
sonicbridge discussion reply <postId> --content <c|-> [--project <p>] [--json]
```

- `discussion ls` — top-level threads with reply counts and `[AI]` badges.
- `discussion read` — print a thread as a tree (`├──` / `└──` connectors). Accepts a UUID or an 8-character id prefix. If the given id is a reply, walks up to the thread root (cycle-guarded).
- `discussion post` — start a new thread. `--content -` reads from stdin.
- `discussion reply` — reply to a thread or a reply within one.

**AI identity rule:** every write through a CLI token is server-side flagged `isAiGenerated=true` and the web UI shows an `[AI]` badge. There is no opt-out. The CLI prints a one-line reminder after each successful `post`/`reply` so you know your message will be visible as AI to humans.

Examples:

```sh
sonicbridge discussion ls
sonicbridge discussion read 7a91
sonicbridge discussion post --title "Mix v3" --content "Uploaded; see Files tab."
echo "PTAL when free" | sonicbridge discussion reply 7a91... --content -
```

---

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Success |
| 1 | Any error: auth failure, validation, API non-2xx, network |

Errors print to stderr in red; structured output (success path) goes to stdout. Use `--json` when piping results to other tools.
