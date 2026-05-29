# sonicbridge CLI — Agent Usage Reference

This is the canonical reference for AI agents driving the `sonicbridge` CLI. Read this once and you should be able to manage every project resource (files, folders, calendar events, discussion threads) from the terminal.

---

## Mental model

- `sonicbridge` is a **project-scoped** CLI. Every command except `login` / `logout` / `whoami` / `project` operates against an active project.
- The active project is set once with `sonicbridge project use <id>` and persists in your config file. Commands also accept `--project <id-or-customId>` to override per-invocation.
- The token grants the user's full project membership permissions — admin vs member rules still apply (e.g., editing someone else's calendar event requires admin).
- Output is human-readable by default. Every list/read command supports `--json` for machine consumption — **use `--json` whenever the next step is "agent reads the result."**

## Authentication

- Login: `sonicbridge login` (interactive prompt) **or** `SONICBRIDGE_TOKEN=sb_xxx sonicbridge login --base-url <url>` (CI / unattended).
- The CLI **never** accepts `--token` on argv. If you see suggestions to pass `--token`, they are wrong; use the env var.
- Logout: `sonicbridge logout` wipes config (token + active project).
- Sanity check: `sonicbridge whoami --json` returns `{ user: { id, username, email, avatar }, projects: [...], activeProject?: {...} }`.

## AI identity — important

**Every Discussion write the CLI makes is automatically flagged `isAiGenerated=true` server-side.** This is enforced by the API based on the request being Bearer-token authenticated; there is no opt-out flag and no way for the CLI to launder its writes as human. The web UI surfaces an `[AI]` badge on these posts and replies.

Practical rules:

- When you `discussion post` or `discussion reply`, your message will be visibly marked as AI to every human viewer. Be transparent — introduce yourself, sign as the assistant, don't pretend to be the human whose token you're using.
- The CLI does not expose `discussion edit` — editing existing posts only happens via the web UI or the raw API. (If your agent calls the raw `PATCH /api/projects/[id]/discussion/[postId]` endpoint directly with the same bearer token, the server flips `isAiGenerated` to true on that post; this is one-way sticky. Not relevant for CLI-only workflows.)
- Calendar events, file uploads, and folder operations do **not** carry an AI flag.

## Conventions

- **Dates:** ISO 8601 (`2026-06-01T10:00:00Z`) **or** local `YYYY-MM-DD HH:mm` (parsed in the host machine's local timezone, then converted to UTC before sending).
- **IDs:** UUID v4 strings everywhere (`8c4f1...`). Every id-accepting command also accepts the 8-character prefix shown in `ls` output — see "Prefix resolution rule" below.
- **JSON output:** every list/read command has a `--json` flag. The shape is the same as the API response (so the docs at `app/api/projects/[id]/...` are authoritative for field names).
- **Exit codes:** `0` success, `1` any error (auth, API, validation, network). Errors print to stderr; success output goes to stdout.
- **Stdin:** `discussion post --content -` and `discussion reply --content -` read the body from stdin until EOF. Useful for piping `cat notes.md | sonicbridge discussion post --title 'Mix v2' --content -`.

## Prefix resolution rule

Every command that takes an id (file, folder, event, post) accepts either:
- the full UUID, or
- a unique 8-character prefix (the same prefix shown in `ls` output).

The CLI fetches the relevant list, finds the unique match, and uses the full UUID on the wire. If the prefix is ambiguous, the CLI prints

```
<label> prefix "<input>" is ambiguous (matches N). Use more characters or the full UUID.
```

and exits 1. If nothing matches, it prints `No <label> matches "<input>".` and exits 1.

This rule applies to: `calendar edit`, `calendar rm`, `discussion reply`, `discussion read`, `files mv`, `files rm`, `files rename`, `folders rename`, `folders rm`. New commands should adopt the same pattern.

## Commands

### `login`

Authenticate the CLI against a Sonic Bridge instance.

```
sonicbridge login [--base-url <url>]
```

- `--base-url <url>` defaults to `https://sonicbridge.app`. Set it once and the value persists; you don't need to pass it on subsequent logins unless switching servers.
- Token source order: `SONICBRIDGE_TOKEN` env var → hidden interactive prompt.
- Validates against `GET /api/user/me`. On 200, persists `{ baseUrl, token }` and clears `activeProject` if you changed `baseUrl`. On non-200, exits 1 with the server's error message.

```
$ sonicbridge login
Base URL: https://sonicbridge.app
Token (sb_...): ******
Logged in as alice (alice@example.com).
```

### `logout`

```
sonicbridge logout
```

Removes the config file. No network call. Next invocation will re-print the welcome banner sentinel? — no; the welcome sentinel is independent. Just `login` again.

### `whoami`

```
sonicbridge whoami [--json]
```

Hits `/api/user/me`.

Human output (2-3 lines — projects table moved to `project ls`):

```
Logged in as alice (alice@example.com)
Active project: My Band (cd5e1b2a)
Run `sonicbridge project ls` to see your projects.
```

The "Active project:" line is omitted if no active project is set.

JSON output (machine consumers should prefer `project ls --json`; this shape is kept for back-compat):

```json
{
  "user": { "id": "...", "username": "alice", "email": "alice@example.com", "avatar": null },
  "projects": [
    { "id": "cd5e...", "customId": "my-band", "name": "My Band", "role": "admin" },
    { "id": "a91f...", "customId": null, "name": "Side Project", "role": "member" }
  ],
  "activeProject": { "id": "cd5e...", "customId": "my-band", "name": "My Band" }
}
```

### `project ls` / `project use`

```
sonicbridge project ls [--json]
sonicbridge project use <idOrCustomId>
```

`ls` shows your memberships. Human output has only `id` (8-char prefix), `name`, and `role` columns — `customId` was removed (it was sparsely populated and cluttered the table; the UUID prefix is the canonical CLI id). The `--json` output still includes `customId` for any consumer that needs it.

`use` validates the id/customId against `/api/user/me` and persists it as `activeProject` in config. After `use`, you can omit `--project` on every other command.

Human output:

```
  id        name           role
  cd5e1b2a  My Band        admin
  a91f8c7d  Side Project   member
```

### `files ls`

```
sonicbridge files ls [--folder <id>] [--project <p>] [--json]
```

GET `/api/projects/<p>/files?folderId=<f>`. With no `--folder`, lists files at the project root.

JSON:

```json
{
  "files": [
    {
      "id": "f0d1...",
      "name": "mix-v2.wav",
      "size": 31457280,
      "mimeType": "audio/wav",
      "folderId": null,
      "uploadedBy": "...",
      "uploaderName": "alice",
      "uploadedAt": "2026-05-27T14:32:00.000Z"
    }
  ]
}
```

### `files upload`

```
sonicbridge files upload <localPath> [--folder <id>] [--project <p>] [--json]
```

Three-step on the wire: `POST /upload-url` → PUT bytes to the presigned URL → `POST /files` to register. Progress bar shown on TTY.

```
$ sonicbridge files upload ./mix-v2.wav
[===========>     ] 18.4 MB / 30.0 MB
Uploaded mix-v2.wav (id: f0d1...).
```

### `files download`

```
sonicbridge files download <fileId> [--out <path>] [--project <p>]
```

GET `/api/projects/<p>/files/<id>`. Streams to disk; default output is the server's filename (sanitized via `path.basename` to prevent traversal).

- `--out -` streams to stdout (useful for piping).
- `--out <path>` writes verbatim (user opted in).
- Returns 404 if the file doesn't exist or you can't see it.

### `files mv`

```
sonicbridge files mv <fileId> --to <folderId|root> [--project <p>] [--json]
```

PATCH `/api/projects/<p>/files/<id>` with `{ folderId }`. Pass `root` to move to the project root. The destination folder must belong to the same project.

### `files rm` (destructive — needs password)

```
sonicbridge files rm <fileId> [--project <p>]
```

Two-step:

1. Pre-flight HEAD `/api/projects/<p>/files/<id>` so a typo'd id short-circuits with a friendly 404 *before* the password prompt.
2. Interactive password prompt → POST `/api/user/verify-password` → mints a short-lived (5 min, single-use) challenge token (`ch_...`).
3. DELETE `/api/projects/<p>/files/<id>` with `X-Delete-Challenge: ch_...` header.

The challenge is **only consumed if the file exists**, so typoing the fileId costs nothing. Rate limit: 5 wrong password attempts per 15 min returns `429`.

**Agents should not run `files rm` autonomously** — it requires a password prompt that an unattended runner can't answer. Use it only with a human in the loop.

### `files rename`

```
sonicbridge files rename <fileId> <newName> [--project <p>] [--json]
```

PATCH `/api/projects/<p>/files/<id>` with `{ name }`. Accepts the full UUID or an 8-char prefix (per the prefix resolution rule).

**Extension lock — server-enforced.** The file's extension may not change. Renaming `mix.wav → mix-final.wav` works; renaming `mix.wav → mix-final.mp3` returns `422 { error: "extension_change_not_allowed", currentExt: "wav", newExt: "mp3" }` and the CLI prints:

```
Extension cannot be changed (.wav → .mp3). Use the same extension as the original.
```

The CLI also emits a yellow warning before sending if it detects an extension change, so the server round-trip is just a hard fallback.

**Dotfiles** (`.gitignore`, `.env`, anything whose first character is `.` with no other dot) are treated as **no-extension** on both client and server — they use `idx <= 0` for `lastIndexOf(".")`. So renaming `.gitignore → .gitignore2` is allowed (both have empty extension).

Client-side guards (before any API call):
- `newName` must be non-empty.
- `newName` length ≤ 200.
- No path separators (`/`, `\`) or ASCII control characters.

JSON output (success):

```json
{ "file": { "id": "f0d1...", "name": "mix-final.wav" } }
```

Errors:
- 404 → `File <id> not found.` (exit 1)
- 422 `extension_change_not_allowed` → as above (exit 1)
- Ambiguous prefix → `file prefix "<input>" is ambiguous (matches N)...` (exit 1)

Example:

```sh
sonicbridge files rename f0d1 mix-final.wav
# Renamed mix-v2.wav → mix-final.wav (id: f0d1abcd).
```

### `folders ls`

```
sonicbridge folders ls [folderId] [--project <p>] [--json]
```

- `folders ls` with no argument: tree view of all folders in the project.
- `folders ls <folderId>`: files **inside** that folder (calls `files` API with `folderId`).

### `folders mkdir`

```
sonicbridge folders mkdir <name> [--parent <id>] [--project <p>] [--json]
```

POST `/api/projects/<p>/folders`. Without `--parent`, creates at the project root. Name must be non-empty and ≤200 chars.

### `folders rm`

```
sonicbridge folders rm <folderId> [--project <p>]
```

DELETE `/api/projects/<p>/folders/<id>`. **Server refuses non-empty folders with 409 `{ error: "folder_not_empty" }`** — empty the folder yourself first (move or delete files + sub-folders). No password prompt for folder delete.

### `folders rename`

```
sonicbridge folders rename <folderId> <newName> [--project <p>] [--json]
```

PATCH `/api/projects/<p>/folders/<id>` with `{ name }`. Accepts the full UUID or an 8-char prefix (per the prefix resolution rule).

No extension constraint (folders don't have one). Client-side guards: non-empty, ≤200 chars, no path separators or ASCII control characters.

Errors:
- 404 → `Folder <id> not found.` (exit 1)
- Ambiguous prefix → `folder prefix "<input>" is ambiguous (matches N)...` (exit 1)

Example:

```sh
sonicbridge folders rename 4b1c "Mix Sessions"
# Renamed folder → Mix Sessions (id: 4b1cabcd).
```

### `calendar add`

```
sonicbridge calendar add \
  --title <t> --start <date> --end <date> \
  [--desc <d>] [--type meeting|production|release|other] \
  [--project <p>] [--json]
```

POST `/api/projects/<p>/schedule`. `--title`, `--start`, `--end` are required. Default `--type` is `other`. `--end` must be strictly after `--start` (validated client-side).

### `calendar ls`

```
sonicbridge calendar ls [--from <date>] [--to <date>] [--project <p>] [--json]
```

GET `/api/projects/<p>/schedule?startDate=<from>&endDate=<to>`. Default window: now → now + 30 days.

### `calendar edit`

```
sonicbridge calendar edit <eventId> \
  [--title <t>] [--start <date>] [--end <date>] [--desc <d>] [--type <t>] \
  [--project <p>] [--json]
```

PATCH. Only the creator or a project admin can edit; non-creator member gets `403` ("Only the creator or a project admin can edit this event.").

### `calendar rm`

```
sonicbridge calendar rm <eventId> [--project <p>]
```

DELETE. Same role gating as edit. No password challenge.

### `discussion ls`

```
sonicbridge discussion ls [--project <p>] [--json]
```

GET `/api/projects/<p>/discussion`. Lists top-level threads (replies are folded). The human-readable table shows the `[AI]` badge in the `ai` column. JSON returns the full flat list including replies — filter `parentId === null` for threads.

### `discussion read`

```
sonicbridge discussion read <postId> [--project <p>] [--json]
```

Renders the thread as an ASCII tree. The `postId` follows the global prefix resolution rule. If you pass a reply id (not a thread root), the CLI walks `parentId` up to the root for full thread context (cycle-guarded against malformed server data).

Sample:

```
Mix v2 notes [AI] — by alice @ 2026-05-27T14:32:00.000Z
-----
Bumped bass by 1.5 dB. PTAL.
-----
├── 9d4e... by bob @ 2026-05-27T15:01:00.000Z
    Sounds good.
└── 8f2c... by alice [AI] @ 2026-05-27T15:10:00.000Z
    Pushed v3.
```

### `discussion post`

```
sonicbridge discussion post --title <t> --content <c|-> [--project <p>] [--json]
```

POST `/api/projects/<p>/discussion` body `{ hasParent: false, title, content }`. Use `--content -` to pipe body from stdin.

```
$ echo "Pushed mix-v3 with bass adjustment." | \
    sonicbridge discussion post --title "Mix v3" --content -
Posted thread (id: 7a91...). Note: writes via the CLI token are flagged
isAiGenerated=true and will display an [AI] badge in the web UI.
```

### `discussion reply`

```
sonicbridge discussion reply <postId> --content <c|-> [--project <p>] [--json]
```

POST `/api/projects/<p>/discussion` body `{ hasParent: true, parentId, content }`. `postId` is the post you're replying to (not necessarily the thread root).

### `help`

```
sonicbridge help [topic]
```

Topics: `login`, `project`, `files`, `folders`, `calendar`, `discussion`. Without a topic, prints the top-level command list. The shipped help text is mirrored in [`help.md`](./help.md).

---

## Mini patterns

### Upload a build artifact and announce it

```sh
ARTIFACT_ID=$(sonicbridge files upload ./out/mix-v3.wav --json | jq -r '.file.id')
sonicbridge discussion post \
  --title "Mix v3 build" \
  --content "New mix uploaded: file id $ARTIFACT_ID. See Files tab."
```

The thread will appear with an `[AI]` badge, which is correct — an AI agent posted it.

### Get tomorrow's calendar

GNU date (Linux / Git Bash on Windows):

```sh
TOMORROW=$(date -u -d '+1 day' +%Y-%m-%dT00:00:00Z)
DAY_AFTER=$(date -u -d '+2 day' +%Y-%m-%dT00:00:00Z)
sonicbridge calendar ls --from "$TOMORROW" --to "$DAY_AFTER" --json
```

BSD date (macOS) — `-d '+1 day'` doesn't exist; use `-v+1d`:

```sh
TOMORROW=$(date -u -v+1d +%Y-%m-%dT00:00:00Z)
DAY_AFTER=$(date -u -v+2d +%Y-%m-%dT00:00:00Z)
sonicbridge calendar ls --from "$TOMORROW" --to "$DAY_AFTER" --json
```

### Find AI-flagged posts in the active project

```sh
sonicbridge discussion ls --json | jq '.[] | select(.isAiGenerated == true)'
```

### Bulk-empty a folder before deleting it (human-in-the-loop)

`folders ls <folderId>` only lists **files** inside that folder, not sub-folders. To delete a folder you must remove both files AND any sub-folders first, otherwise `folders rm` fails with 409 `folder_not_empty`.

```sh
# 1) List files inside the target folder
sonicbridge folders ls <folderId> --json

# 2) Identify sub-folders from the project-wide tree (parentId == <folderId>)
sonicbridge folders ls --json | jq -r --arg p "<folderId>" '.folders[] | select(.parentId == $p) | .id'

# 3) For each sub-folder, recurse into this same pattern (delete its contents, then itself)

# 4) Delete each file (password prompt per delete)
for fid in $(sonicbridge folders ls <folderId> --json | jq -r '.files[].id'); do
  sonicbridge files rm "$fid"
done

# 5) Now the folder is empty:
sonicbridge folders rm <folderId>
```

Agents should pause and ask the human for password / approval before running the `files rm` loop above — it is destructive.

---

## See also

- [`install-for-agents.md`](./install-for-agents.md) — install + token + allowlist setup
- [`help.md`](./help.md) — long-form mirror of `sonicbridge help <topic>`
- `cli/src/commands/*.ts` — source of truth if a doc disagrees with the binary
