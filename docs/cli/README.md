# sonicbridge CLI — Documentation

`sonicbridge` is the official command-line interface for the [Sonic Bridge](https://sonicbridge.app) platform. It lets humans **and AI agents** drive every project resource — files, folders, calendar events, discussion threads — from a terminal, authenticated by a per-user CLI token generated in Project Settings.

## Docs in this folder

| Doc | For whom |
|---|---|
| [install-for-agents.md](./install-for-agents.md) | Humans installing the CLI for their own AI agent or for personal use |
| [agent-usage.md](./agent-usage.md) | AI agents driving the CLI — full command reference + conventions |
| [help.md](./help.md) | Long-form mirror of what `sonicbridge help <topic>` prints |

## 30-second taste

```sh
sonicbridge login                                                    # paste token
sonicbridge files upload ./mix.wav                                   # upload to root
sonicbridge discussion post --title "Mix v2" --content "see attached"
```

Every Discussion write made through a CLI token is server-side flagged `isAiGenerated=true` — the web UI shows an `[AI]` badge on those posts. This is by design (per the locked design decision in `docs/superpowers/specs/2026-05-27-cli-and-drag-drop-design.md`) so humans can always tell automation apart from people.

## See also

- `cli/README.md` — install + quickstart (canonical place to start)
- `docs/superpowers/specs/2026-05-27-cli-and-drag-drop-design.md` — the design that produced the CLI
