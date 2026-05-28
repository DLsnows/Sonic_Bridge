# CLI Tool + Files Drag-and-Drop — Design Spec

**Date:** 2026-05-27
**Status:** Approved (brainstorm locked with user 2026-05-27)
**Main branch:** `feature/cli-and-drag-drop`

## Problem

Two related gaps:

1. **Files Storage** — users cannot move files between folders in the UI. Once uploaded, a file is stuck wherever it was uploaded.
2. **No first-class agent / scripting surface.** Project Settings already exposes a token (`sb_...`) and `lib/api-auth.ts` already accepts `Authorization: Bearer sb_...`, but there is no CLI for humans or AI agents to use it. The team wants AI agents to manage project files, calendar events, and discussion posts from a terminal.

## Goals

- Drag files between folders in the Files browser.
- Ship a `sonicbridge` CLI that uses the existing per-user token from Project Settings to perform every meaningful project operation: files, folders, calendar, discussion.
- All AI/CLI writes to Discussion are flagged `isAiGenerated=true` so humans can tell them apart visually.
- Deleting files requires re-entering the user's password (challenge-token flow). Folder deletion only succeeds when the folder is empty.
- Three documentation artifacts: agent-facing usage doc, CLI help doc, and an install / setup guide.

## Locked Decisions (from brainstorm)

| Decision | Choice |
|---|---|
| CLI binary name | `sonicbridge` |
| CLI code location | Same repo, `cli/` subdirectory with its own `package.json` |
| AI flag rule | Every Discussion write made via Bearer-token (`Authorization: Bearer sb_...`) is stored with `isAiGenerated=true`. Session writes stay `false`. |
| Password verification flow | `POST /api/user/verify-password` returns a short-lived challenge token (5 min, single-use). File DELETE accepts this challenge token via header. CLI prompts for the password interactively (never via argv). |

## Architectural Pieces

### A. Server changes

**A1. Move-file endpoint (used by both drag-drop UI and CLI)**

- `PATCH /api/projects/[id]/files/[fileId]` accepting `{ folderId?: string|null, name?: string }`.
- Uses `authenticate()` (works for both session and Bearer token).
- Validates new `folderId` belongs to the same project, or is `null` (root).
- Returns updated row.

**A2. Make Discussion & Schedule API token-aware**

- Replace the `auth()` + manual `projectMembers` checks in:
  - `app/api/projects/[id]/discussion/route.ts` (GET, POST)
  - `app/api/projects/[id]/discussion/[postId]/route.ts` (PATCH, DELETE)
  - `app/api/projects/[id]/schedule/route.ts` (GET, POST)
  - `app/api/projects/[id]/schedule/[eventId]/route.ts` (PATCH, DELETE)
- Replace with `authenticate(request, rawId)` (exactly as Files API does today).
- When the request authenticated via `Bearer sb_...`, all newly created or edited `discussionPosts` rows are written with `isAiGenerated=true`. (`authenticate()` should expose an `isToken: boolean` flag — see A4.)

**A3. Password-challenge flow for file delete**

- New `POST /api/user/verify-password`: body `{ password: string }`.
  - Verifies against `users.passwordHash` via `bcryptjs.compare`.
  - On success, returns `{ challenge: "ch_<32 hex>", expiresAt: <iso> }`. Persist in a new `delete_challenges` table: `{ id, userId, challenge (hashed sha256), expiresAt, usedAt }`.
  - Rate-limit: max 5 failed attempts per user per 15 min (in-memory map keyed by userId is fine for v1).
- `DELETE /api/projects/[id]/files/[fileId]` now requires header `X-Delete-Challenge: ch_...`.
  - Validates: challenge exists, belongs to `authResult.userId`, not used, not expired.
  - Marks `usedAt = now()` atomically (single UPDATE … WHERE used_at IS NULL RETURNING).
  - If no header / invalid challenge → 401 with `{ error: "challenge_required" }`.

**A4. `authenticate()` returns `isToken`**

- Add `isToken: boolean` field to `AuthResult`. `true` when the request authenticated via Bearer, `false` for session.
- Used by discussion POST/PATCH to decide `isAiGenerated`.

**A5. `GET /api/user/me` (for `sonicbridge login`/`whoami`)**

- Authenticated via `authenticate()` but does NOT require a project — accepts header-only token.
- Add a project-less variant: `authenticateUser(request)` that only checks the token and returns `{ userId, username, email, isToken }`. Use it in `/api/user/me`.
- Response: `{ user: { id, username, email, avatar }, projects: [{ id, customId, name, role }] }`.

**A6. Settings UI rename**

- `app/(dashboard)/projects/[id]/settings/page.tsx`:
  - Section heading "API Access" → "CLI Access".
  - Helper copy: "Generate a token to use the **sonicbridge** CLI from AI agents or scripts. See `docs/cli/install-for-agents.md`."
- `GenerateToken.tsx`:
  - Button label "Generate API Token" → "Generate CLI Token".
  - Copied state stays "Copied".
- Keep the `/api/user/token` endpoint name unchanged — it's an internal API surface, not user-facing.

### B. Files drag-and-drop UI

- HTML5 drag-and-drop in `components/files/`:
  - **`FileList.tsx`** — make each file row `draggable`. On `dragstart`, set `dataTransfer.setData("application/x-sb-file", fileId)` and a visual ghost.
  - **`FolderTree.tsx`** — each folder node (including Root) becomes a drop target. On `dragover` prevent default + show a highlighted ring. On `drop`, read fileId and call `PATCH /api/projects/[id]/files/[fileId] { folderId }`.
  - **`BreadcrumbNav.tsx`** — each breadcrumb segment is also a drop target so users can drop "up" into an ancestor.
  - **`FileBrowser.tsx`** — owns `handleMoveFile(fileId, targetFolderId)`; calls PATCH, on success refetches the current folder + folder tree. Optimistic update: remove from the current list immediately, roll back on error with a toast.
- Visual states:
  - Dragged file row → 50% opacity.
  - Valid drop target → ring-2 ring-[#00FF41] + bg tint.
  - Invalid drop (e.g., dropping onto current folder) → no highlight.
- Edge cases:
  - Drop onto the folder the file already lives in → no-op (don't call API).
  - Drop onto a folder while a parallel upload is in flight → still fine; PATCH on a non-existent fileId returns 404 and we surface a toast.

### C. CLI package (`cli/`)

Layout:

```
cli/
  package.json           # name: "sonicbridge", bin: { sonicbridge: "./dist/index.js" }
  tsconfig.json
  src/
    index.ts             # commander entrypoint
    config.ts            # token + base URL + active project storage
    api.ts               # fetch wrapper that adds Authorization header
    commands/
      welcome.ts         # first-run banner
      login.ts
      logout.ts
      whoami.ts
      project.ts         # `project use <id-or-customId>` / `project ls`
      files.ts           # upload/download/ls/mv/rm
      folders.ts         # ls/mkdir/rm/mv (mv optional v1)
      calendar.ts        # add/ls/edit/rm
      discussion.ts      # ls/read/post/reply
      help.ts            # rich help text mirrored from docs
    util/
      prompt.ts          # interactive password / yes-no prompt
      table.ts           # ASCII table formatter
      progress.ts        # upload/download progress bar
```

Config storage:

- Use OS conventional config dir via `env-paths` (no extra deps if we hand-code: `%APPDATA%/sonicbridge/config.json` on Windows, `~/.config/sonicbridge/config.json` on Linux/macOS).
- File contents: `{ baseUrl, token, activeProject?: { id, customId?, name } }`.
- `chmod 0600` on POSIX.
- First-run sentinel: if config file does not exist, print the welcome banner before any other output.

Welcome banner (first run only):

```
╔══════════════════════════════════════════════════════════╗
║                  Welcome to SonicBridge CLI              ║
╠══════════════════════════════════════════════════════════╣
║  Manage Sonic Bridge project files, calendar events,     ║
║  and discussion posts from your terminal — built for     ║
║  humans and AI agents alike.                             ║
║                                                          ║
║  1. Generate a CLI token in Project Settings → CLI       ║
║     Access on https://sonicbridge.app                    ║
║  2. Run:  sonicbridge login                              ║
║  3. Run:  sonicbridge --help                             ║
╚══════════════════════════════════════════════════════════╝
```

Command surface:

| Command | Behavior |
|---|---|
| `sonicbridge login` | Prompts for base URL (default https://sonicbridge.app) then token. Validates via `GET /api/user/me`. Stores config. |
| `sonicbridge logout` | Wipes config. Confirms with the username being removed. |
| `sonicbridge whoami` | Hits `/api/user/me`, prints user + project memberships + active project. |
| `sonicbridge project ls` | Lists projects the token can access. |
| `sonicbridge project use <id-or-customId>` | Sets `activeProject` in config so subsequent commands can omit `--project`. |
| `sonicbridge files ls [--folder <id>] [--project <p>]` | Lists files in a folder (root if omitted). |
| `sonicbridge files upload <localPath> [--folder <id>] [--project <p>]` | Two-step: `POST /upload-url` then PUT, then `POST /files`. Shows progress. |
| `sonicbridge files download <fileId> [--out <path>] [--project <p>]` | Streams `GET /files/[fileId]` to disk (or stdout if `--out -`). |
| `sonicbridge files mv <fileId> --to <folderId\|root> [--project <p>]` | `PATCH /files/[fileId] { folderId }`. |
| `sonicbridge files rm <fileId> [--project <p>]` | Prompts for password → calls `/api/user/verify-password` → gets challenge → calls DELETE with `X-Delete-Challenge`. |
| `sonicbridge folders ls [--project <p>]` | Tree view of all folders. |
| `sonicbridge folders ls <folderId>` | Lists subfolders + files in that folder. |
| `sonicbridge folders mkdir <name> [--parent <id>] [--project <p>]` | POST `/folders`. |
| `sonicbridge folders rm <folderId> [--project <p>]` | DELETE only succeeds server-side if folder is empty (we modify the existing DELETE to reject when it has any files or subfolders — currently it cascades, which contradicts the spec). |
| `sonicbridge calendar add --title --start --end [--desc] [--type meeting\|production\|release\|other] [--project <p>]` | POST `/schedule`. Accepts ISO 8601 or `YYYY-MM-DD HH:mm`. |
| `sonicbridge calendar ls --from <iso> --to <iso> [--project <p>]` | GET `/schedule?startDate&endDate`. |
| `sonicbridge calendar edit <eventId> [--title] [--start] [--end] [--desc] [--type] [--project <p>]` | PATCH `/schedule/[eventId]`. |
| `sonicbridge calendar rm <eventId> [--project <p>]` | DELETE `/schedule/[eventId]`. |
| `sonicbridge discussion ls [--project <p>]` | Lists threads (title, author, isAiGenerated badge, reply count). |
| `sonicbridge discussion read <postId> [--project <p>]` | Prints the thread including all replies in tree form. |
| `sonicbridge discussion post --title <t> --content <c\|-> [--project <p>]` | Creates a new thread. Content `-` reads from stdin. Always stored `isAiGenerated=true`. |
| `sonicbridge discussion reply <postId> --content <c\|-> [--project <p>]` | Replies to a thread. Always `isAiGenerated=true`. |
| `sonicbridge help [topic]` | Rich help text per topic; `sonicbridge --help` works too. |

Folder-empty enforcement: change `DELETE /api/projects/[id]/folders/[folderId]` to refuse when it has any file or sub-folder, returning `409 { error: "folder_not_empty" }`. The current cascade behavior surprises CLI users.

### D. Documentation (`docs/cli/`)

1. **`docs/cli/agent-usage.md`** — comprehensive how-to for AI agents:
   - Token model + scope
   - Conventions: dates in ISO 8601, file IDs are UUIDs, etc.
   - Every command with example invocation, sample stdout (JSON when `--json` is passed, human-readable otherwise), exit codes
   - AI-flag rule explicit so agents know their messages are visible as such
   - Mini patterns: "upload a build artifact and post a discussion thread linking it", "fetch tomorrow's calendar"
2. **`docs/cli/help.md`** — long-form help text. Mirrors agent-usage but trimmed to what `sonicbridge help <topic>` prints.
3. **`docs/cli/install-for-agents.md`** — for the human installing the CLI for their own agent:
   - `npm i -g sonicbridge` (once published) or `npm link` from a checkout
   - Generating a token in Project Settings (with screenshot placeholder)
   - Recommended `.claude/settings.json` / agent system-prompt snippet that injects `sonicbridge` permissions
   - How to scope agents to specific projects (`project use`)

## Verification

Each sub-PR carries its own checklist; the umbrella verification on the main branch:

1. From a fresh checkout: `cd cli && npm install && npm run build && npm link` produces a working `sonicbridge` binary on PATH.
2. Run `sonicbridge login` against a local `next dev` server, paste a valid token, see `Logged in as <username>`.
3. Drag-drop: in the Files page, drag a file from list onto a folder in the tree, see it disappear from the current list and reappear in the target folder when you click into it. Drag onto its current folder is a no-op.
4. CLI round-trip:
   - `sonicbridge files upload ./test.wav` → file appears in web UI.
   - `sonicbridge files ls` → shows the new file.
   - `sonicbridge files mv <id> --to <folderId>` → moves it; web UI reflects.
   - `sonicbridge files rm <id>` → prompts for password, file disappears after correct password, refuses after wrong password.
5. Calendar: `sonicbridge calendar add --title "Mix review" --start "2026-06-01 10:00" --end "2026-06-01 11:00"` → event shows in the schedule grid.
6. Discussion: `sonicbridge discussion post --title test --content "hello from CLI"` → thread appears with an AI badge.
7. Replying via web (session) to the same thread → no AI badge.

## Non-Goals (v1)

- npm publish — we link locally and ship publishing later.
- Folder move (`folders mv`) — punt to v2, file move covers 90% of the pain.
- WebSocket / streaming discussion — CLI is request/response only.
- OAuth flow — token-only.
- Per-project sub-tokens — token is per user; project access is derived from membership.
