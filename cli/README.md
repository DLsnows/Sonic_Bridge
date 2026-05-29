# sonicbridge CLI

Command-line tool for the [Sonic Bridge](https://sonicbridge.app) platform.
Manage project files, folders, calendar events, and discussion threads from
your terminal — built for humans and AI agents alike.

## Install (from a checkout)

```sh
cd cli
npm install
npm run build
npm link
sonicbridge --help
```

A globally published `npm i -g sonicbridge` is planned for a later release.

## Quickstart

```sh
# 1. Generate a CLI token in the web app: Project Settings → CLI Access
# 2. Authenticate the CLI (paste the token into the hidden prompt):
sonicbridge login
# 3. Pick a default project so you can omit --project:
sonicbridge project ls
sonicbridge project use <idOrCustomId>
# 4. Try it:
sonicbridge files ls
sonicbridge files upload ./my-mix.wav
sonicbridge calendar add --title "Mix review" --start "2026-06-01 10:00" --end "2026-06-01 11:00"
sonicbridge discussion post --title "Mix v2 notes" --content "Bumped bass by 1.5 dB."
```

### Unattended / CI use

For non-interactive contexts, set the token in the environment instead of
typing it into the prompt:

```sh
SONICBRIDGE_TOKEN=sb_xxx sonicbridge login --base-url https://sonicbridge.app
```

The CLI deliberately does not accept a `--token` flag — argv ends up in shell
history and `/proc/<pid>/cmdline`, which would leak the bearer.

## Commands shipped in this release

| Group | Commands |
|---|---|
| auth | `login`, `logout`, `whoami` |
| project | `project ls`, `project use <id>` |
| files | `files ls`, `files upload <path>`, `files download <id>`, `files mv <id> --to <folderId\|root>`, `files rename <id> <newName>`, `files rm <id>` |
| folders | `folders ls [folderId]`, `folders mkdir <name>`, `folders rename <id> <newName>`, `folders rm <folderId>` |
| calendar | `calendar add`, `calendar ls`, `calendar edit <eventId>`, `calendar rm <eventId>` |
| discussion | `discussion ls`, `discussion read <postId>`, `discussion post`, `discussion reply <postId>` |
| help | `help [topic]` |

Calendar dates accept ISO 8601 or local `YYYY-MM-DD HH:mm`. Every discussion
write made through a CLI token is stamped `isAiGenerated=true` server-side; the
CLI surfaces this with an `[AI]` badge in `discussion ls` and `read` output.

## Documentation

- [`docs/cli/install-for-agents.md`](../docs/cli/install-for-agents.md) — install
  the CLI for your AI agent, generate a token, recommended `.claude/settings.json`
  allowlist.
- [`docs/cli/agent-usage.md`](../docs/cli/agent-usage.md) — full per-command
  reference for AI agents (synopses, JSON output shapes, mini patterns).
- [`docs/cli/help.md`](../docs/cli/help.md) — long-form mirror of
  `sonicbridge help <topic>`.
- [`docs/cli/README.md`](../docs/cli/README.md) — docs landing page.

## Config storage

The CLI stores its config at:

- Windows: `%APPDATA%\sonicbridge\config.json`
- macOS / Linux: `$XDG_CONFIG_HOME/sonicbridge/config.json` (defaults to
  `~/.config/sonicbridge/config.json`)

On POSIX, the file is written with mode `0600`. The token is stored in
plaintext — protect your config file accordingly.

## Development

```sh
npm install
npm run dev   # tsc --watch
npm test      # vitest
npm run lint  # eslint src
```
