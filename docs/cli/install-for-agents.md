# Installing the sonicbridge CLI (for humans setting it up for their agent)

This guide walks a human through installing `sonicbridge` and wiring it up for an AI agent (e.g., Claude Code) to use against a Sonic Bridge project.

## Prerequisites

- **Node.js 20+** (`node -v` to check)
- A **Sonic Bridge account** with membership on at least one project
- For agents: an agent runtime (Claude Code, Cursor, etc.) that can execute shell commands on your machine

## 1. Install the CLI

`sonicbridge` is not yet published to npm. Install from a checkout:

```sh
git clone https://github.com/DLsnows/Sonic_Bridge.git
cd Sonic_Bridge/cli
npm install
npm run build
npm link
sonicbridge --help
```

A global `npm i -g sonicbridge` will land once the package is published — until then `npm link` from a checkout puts the binary on your PATH.

To uninstall: `npm unlink -g sonicbridge`.

## 2. Generate a CLI token

1. Open the Sonic Bridge web app.
2. Navigate to the project you want to manage.
3. **Settings → CLI Access → Generate CLI Token.**
4. Copy the token immediately — it is shown only once, format `sb_<64 hex chars>`.

Notes:

- Tokens are **per-user, not per-project.** Project access derives from your membership. A single token can manage every project you're a member of.
- Generating a new token **invalidates the previous one**. If a token leaks, regenerate to revoke.
- A token grants every operation the user can do via the web UI (subject to admin vs member role).

## 3. Authenticate the CLI

**Interactive (recommended for humans):**

```sh
sonicbridge login
# Base URL prompt — accept default https://sonicbridge.app or type your own
# Token prompt — paste the sb_... token (input is hidden)
```

**Non-interactive (recommended for CI / unattended agent jobs):**

```sh
SONICBRIDGE_TOKEN=sb_xxx sonicbridge login --base-url https://sonicbridge.app
```

The CLI deliberately does **not** accept a `--token <value>` flag. `argv` ends up in `/proc/<pid>/cmdline` and shell history — leaking the bearer there is unacceptable.

Verify:

```sh
sonicbridge whoami
# Logged in as <username> (<email>)
# Projects: ...
```

## 4. Pick an active project (so agents don't need `--project` everywhere)

```sh
sonicbridge project ls
sonicbridge project use <projectId-or-customId>
```

From now on every `files`/`folders`/`calendar`/`discussion` command can omit `--project`. The agent can re-run `project use` mid-session to switch projects.

## 5. Wire up your AI agent

### Recommended allowlist (`.claude/settings.json` example)

Read-only commands are safe to allowlist so your agent doesn't get blocked on permission prompts during routine work. Write/destructive ones should still prompt.

```jsonc
{
  "permissions": {
    "allow": [
      "Bash(sonicbridge whoami)",
      "Bash(sonicbridge whoami *)",
      "Bash(sonicbridge project ls)",
      "Bash(sonicbridge project ls *)",
      "Bash(sonicbridge files ls *)",
      "Bash(sonicbridge folders ls *)",
      "Bash(sonicbridge calendar ls *)",
      "Bash(sonicbridge discussion ls *)",
      "Bash(sonicbridge discussion read *)",
      "Bash(sonicbridge help *)"
    ]
  }
}
```

Do **not** broadly allowlist:
- `sonicbridge files rm *` — destructive, triggers a password prompt
- `sonicbridge folders rm *` — destructive
- `sonicbridge files rename *` / `folders rename *` — mutating; surface a prompt so the human can spot accidental renames before they hit the project
- `sonicbridge files upload *` / `discussion post *` / `discussion reply *` / `calendar add *` / `calendar edit *` / `calendar rm *` — these write data and should be reviewed

You can still allowlist them per-project or per-command if your workflow needs it.

### Agent system-prompt snippet

When briefing your agent, include something like:

> You have access to the `sonicbridge` CLI. It manages the active project's files, folders, calendar events, and discussion threads. Every Discussion write you make is automatically flagged as AI-generated — do not impersonate humans. For full conventions and command reference, read `docs/cli/agent-usage.md`. Set the active project once with `sonicbridge project use <id>`, then omit `--project` on subsequent commands.

## 6. Switching accounts or projects

- Change projects: `sonicbridge project use <other-id>`
- Change accounts / instances: `sonicbridge logout` then `sonicbridge login` with the new token (and `--base-url` if pointing at a different deployment)

## Security checklist

- [ ] Token stored only in the OS-conventional config dir (`%APPDATA%\sonicbridge\config.json` on Windows, `~/.config/sonicbridge/config.json` on POSIX). On POSIX, the file is `chmod 0600`.
- [ ] No `--token` flag — token never appears in argv.
- [ ] `files rm` requires a password challenge (interactive prompt) even with a valid token. Agents cannot delete files unattended.
- [ ] Folder deletion refuses non-empty folders (server returns `409 folder_not_empty`).
- [ ] Token revocation: regenerate in Settings → old token is instantly invalid.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `Logged out.` after `whoami` returns 401 | Token was regenerated or revoked | `sonicbridge login` again |
| `Not a member of this project` | The token's user isn't on this project | Get added (admin invites) or `project use` a project you're on |
| `challenge_required` on file delete | Trying to delete via raw API without verify-password flow | Use `sonicbridge files rm` (handles the flow) instead |
| `folder_not_empty` (409) | The folder has files or sub-folders | Empty it first: `folders ls <id>` then `files rm` each, or move them out |
| `Extension cannot be changed (.wav → .mp3)` on `files rename` | Server-enforced: rename keeps the extension | Use the same extension as the original. To relocate without renaming, use `files mv`. Dotfiles (`.gitignore`) are no-extension and renameable to any other dotfile name. |
| `<label> prefix "<input>" is ambiguous` | Multiple ids share that prefix | Use a longer prefix or the full UUID. The `ls` output shows the canonical short prefix. |
| CLI silently exits with no output | Almost always means a buggy `invokedAsScript` check or a stale npm link | `cd cli && npm run build && npm link --force` |

## Where to go next

- AI agent driving the CLI? Read [`agent-usage.md`](./agent-usage.md).
- Forgot what a command does? Run `sonicbridge help <topic>` or read [`help.md`](./help.md).
