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
| files | `files ls`, `files upload <path>`, `files download <id>`, `files mv <id> --to <folderId\|root>`, `files rm <id>` |
| folders | `folders ls [folderId]`, `folders mkdir <name>`, `folders rm <folderId>` |
| help | `help [topic]` |

Calendar and discussion commands ship in a follow-up release.

## Documentation

For agent-facing documentation, recommended `.claude/settings.json` snippets,
and the full per-command reference, see `docs/cli/install-for-agents.md` and
the rest of `docs/cli/` (added in a follow-up PR).

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
