# CLI Bug-Bash Round 1 — Design Spec

**Date:** 2026-05-28
**Status:** Approved (brainstorm locked with user 2026-05-28)
**Main branch:** `feature/cli-and-drag-drop` (sub-PRs land here, same flow as round 0)
**Diagnostic input:** `docs/superpowers/diagnostics/2026-05-28-feature-cli-and-drag-drop-bug-investigation.md`

## Background

After landing the initial CLI + drag-drop feature work, the user reported 8 bugs and 4 UX/feature gaps during E2E QA on the Vercel preview. A diagnostic pass (agent above) confirmed root causes for 4 bugs and narrowed the other 4 to a deployment-config issue (not code).

## Locked decisions (from brainstorm)

| Decision | Choice |
|---|---|
| ID consistency | Every CLI command accepts either an 8-char prefix or a full UUID; `ls` keeps showing the short prefix (human-friendly). |
| Rename commands | Separate `files rename` and `folders rename` subcommands (distinct from `mv`). |
| Extension protection | Server-side enforced (422 if the new file name's extension differs from the current); UI also blocks before submit for a snappy UX. MIME type stays whatever it was. |
| BUGS 1–4 root cause | Vercel preview env is missing R2 vars (`R2_*`). Not a code fix — user updates Vercel dashboard to include "Preview" scope on those 5 vars. Documented here for posterity; no PR. |

## Pieces

### Piece 0 — Vercel env config (USER ACTION, not code)

`lib/storage.ts:6-17` requires `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` on every runtime. When any of those is missing on the Vercel preview deployment, `getS3()` throws "Missing R2 environment variables" → `upload-url` returns 500; `normalizeKey()` returns a relative path → `redirect()` to a relative path → browser follows → 502.

**Action:** in Vercel project settings → Environment Variables, check that all 5 `R2_*` vars have **Preview** ticked in addition to Production. Then close+reopen any in-flight PR (or push to the branch) to redeploy.

### Piece A — `verify-password` accepts Bearer tokens (BUG 5)

**Problem:** `/api/user/verify-password` is hard-gated to NextAuth session via `auth()`. CLI is Bearer-only → call always returns 401 → CLI prints "Incorrect password." even for the correct password.

**Fix:** replace the `auth()` gate with `authenticateUser(request)` (which accepts both session AND Bearer). Keep the existing rate-limit (5/15min/user). The endpoint is per-user, not per-project; both auth modes resolve a single `userId` and the rate-limit map already keys on `userId`, so the change is small.

**Spec design rationale:** the original "session-only" rationale was "a leaked Bearer must not mint a delete challenge." But a leaked Bearer already has unrestricted DELETE/PATCH/POST access to every endpoint that uses `authenticate()`. The challenge defends against UI-only attacks (XSS, stolen laptop where the session cookie is hot but the password isn't); it offers no incremental defense against a token leak. Accepting Bearer is consistent with the rest of the auth surface.

**Files:**
- `app/api/user/verify-password/route.ts` — swap `auth()` → `authenticateUser(request)`.
- New test in `__tests__/verify-password.test.ts`: Bearer-authenticated request with correct password returns a challenge; wrong password still 401; rate limit still triggers across both modes.

### Piece B — CLI prefix → UUID resolution (BUGS 7 + 8)

**Problem:** `calendar ls` and `discussion ls` show 8-char prefixes, but `calendar edit/rm` and `discussion reply` send those prefixes verbatim to the server. Schedule API: 500 (Postgres uuid cast crash). Discussion API: 400 (Zod uuid refinement). User has no way to obtain the full UUID.

**Fix:** introduce one shared util that fetches the relevant list, finds a unique full-UUID match starting with the given input, and returns it (or fails with a clear message).

**Files:**
- New `cli/src/util/resolve-id.ts`:
  ```ts
  export async function resolveByPrefix<T extends { id: string }>(
    input: string,
    fetchAll: () => Promise<T[]>,
    label: string,
  ): Promise<T> {
    // Exact match wins. Otherwise look for unique prefix match.
    const all = await fetchAll();
    const exact = all.find((x) => x.id === input);
    if (exact) return exact;
    const matches = all.filter((x) => x.id.startsWith(input));
    if (matches.length === 1) return matches[0];
    if (matches.length === 0) {
      throw new Error(`No ${label} matches "${input}".`);
    }
    throw new Error(
      `${label} prefix "${input}" is ambiguous (matches ${matches.length}). Use more characters or the full UUID.`,
    );
  }
  ```
- `cli/src/commands/calendar.ts`:
  - `runCalendarEdit(eventId, flags)` and `runCalendarRm(eventId, flags)`: before sending the request, call `resolveByPrefix(eventId, () => fetchAllEvents(projectId), "event")` and use the resolved `.id`.
  - Window for `fetchAllEvents`: a wide range (e.g., −1 year to +1 year) so old events are still resolvable.
- `cli/src/commands/discussion.ts`:
  - `runDiscussionReply(parentPostId, flags)`: same pattern — fetch all posts, resolve prefix, use full UUID in body.
  - Audit `runDiscussionRead` — it already does an inline lookup; leave as-is OR replace with `resolveByPrefix` for consistency.
- Server hygiene (PR same branch): wrap PATCH/DELETE handlers at `app/api/projects/[id]/schedule/[eventId]/route.ts` with a UUID-shape check and try/catch so any non-UUID `eventId` returns 400 `"Invalid event id"` instead of 500. (Discussion routes already do this via Zod.) Use the same `UUID_RE` exported by `lib/project-utils.ts`.

### Piece C — CLI `files rm` pre-flight HEAD (BUG 6)

**Problem:** `runFilesRm` prompts for password before checking whether the fileId exists. Typo'd ids burn user time + rate-limit slots.

**Fix:** before prompting, send a `HEAD /api/projects/<p>/files/<fileId>`. The HEAD handler already exists and returns 404 cleanly. On 404, print "File <id> not found." and exit 1.

Also: apply prefix resolution here too — pre-flight via `files ls` fetch + prefix match. Same util as Piece B.

**Files:**
- `cli/src/commands/files.ts` `runFilesRm`: HEAD pre-flight + prefix resolution.
- `cli/src/__tests__/files.test.ts` (new): mock HEAD + DELETE; assert pre-flight 404 short-circuits before password prompt.

### Piece D — Rename file + rename folder (NEW)

**Problem:** No CLI way to rename either; Web has folder rename but no file rename.

**Spec:**

1. **Server: extension protection in PATCH file.** In `app/api/projects/[id]/files/[fileId]/route.ts` PATCH handler, when `name` is being updated:
   - compute `currentExt = current.name.split('.').pop()?.toLowerCase()` and same for `newName`.
   - if `currentExt !== newExt`, return `422 { error: "extension_change_not_allowed", currentExt, newExt }`.
   - the existing zod schema already rejects path separators and control chars; extension check is the new constraint.

2. **CLI: `sonicbridge files rename <fileIdOrPrefix> <newName>`.**
   - Resolve prefix via Piece B util.
   - Validate `newName` is non-empty, ≤200 chars, no `/`/`\`/control chars (client-side first-pass).
   - Compute and warn (not error) if the user-supplied name has no extension or different extension than current; let the server be authoritative.
   - PATCH `/files/<id>` with `{ name }`.
   - On 422 from server (`extension_change_not_allowed`): print friendly error including current vs proposed extension.

3. **CLI: `sonicbridge folders rename <folderIdOrPrefix> <newName>`.**
   - Resolve prefix via Piece B util.
   - PATCH `/folders/<id>` (already supports `{ name }`).
   - No extension constraint for folders.

4. **Web: inline file rename.**
   - `components/files/FileList.tsx`: add a rename action (pencil icon next to download/delete on hover), or right-click-style menu.
   - Use a small inline `<input>` mode that hot-replaces the name span, with Enter to submit / Esc to cancel. Validate ext match client-side before submit; on the server's 422, surface a toast with the actual extensions.
   - Wire through the existing PATCH endpoint.

5. **Web: folder rename UX already exists** (via the `✎` button next to each folder in the tree, calling PATCH `/folders/<id>`). No change.

**Files:**
- `app/api/projects/[id]/files/[fileId]/route.ts` — extension check in PATCH.
- `__tests__/files-patch.test.ts` — add 2 cases: rename within same ext succeeds; rename with different ext returns 422.
- `cli/src/commands/files.ts` — new `runFilesRename(fileId, newName, flags)`.
- `cli/src/commands/folders.ts` — new `runFoldersRename(folderId, newName, flags)`.
- `cli/src/index.ts` — wire `files rename <fileId> <newName>` and `folders rename <folderId> <newName>` into commander.
- `cli/src/commands/help.ts` — update the `files` and `folders` topic blocks to mention `rename`.
- `components/files/FileList.tsx` — inline rename input + handler.
- `components/files/FileBrowser.tsx` — `handleRenameFile(fileId, newName)` calling the PATCH endpoint.
- Tests for the CLI commands (commander parsing + happy path).

### Piece E — CLI `whoami` cleanup (#9)

**Problem:** `whoami` currently shows username + email AND the full project list with customId column. The user finds the projects list out-of-place there.

**Fix:**
1. Remove the projects list from human output of `whoami`. Output reduces to:
   ```
   Logged in as alice (alice@example.com)
   Active project: my-band (cd5e1b2a...)   # only if active project is set
   Run `sonicbridge project ls` to see all your projects.
   ```
2. `--json` output keeps `projects` for backwards-compat with any agent that's already piping the result; add a comment in the human help that machine consumers should prefer `project ls --json`.
3. Remove the `customId` column from `project ls` human output. JSON still has it. Rationale: customIds are sparsely populated and clutter the table; the UUID prefix is the canonical id for CLI use.

**Files:**
- `cli/src/commands/whoami.ts` — drop the projects render block; add the one-liner pointer.
- `cli/src/commands/project.ts` — remove the customId column from the human table.
- `cli/src/__tests__/whoami.test.ts` and `project.test.ts` — update assertions.
- Docs: `docs/cli/agent-usage.md`, `docs/cli/help.md` — update the `whoami` and `project` sections.

### Piece F — Documentation refresh

Every existing doc that mentions a command surface needs to stay in sync. After all of A–E land, sweep through:
- `docs/cli/README.md`
- `docs/cli/install-for-agents.md`
- `docs/cli/agent-usage.md` — add `files rename`, `folders rename`, the prefix-resolution rule (any command accepts prefix), and the updated `whoami` output. Remove the outdated `discussion read` parent-walk paragraph in favor of "all id-accepting commands accept prefix".
- `docs/cli/help.md`
- `cli/README.md`
- `sonicbridge help <topic>` output — verify each topic block matches the docs.

Either bundle the doc sweep into the last sub-PR (Piece D or E) or do it as its own short PR after the others land.

## Sub-PR breakdown

```
α — fix/cli-prefix-and-rm-preflight    (BUGS 6, 7, 8; depends on nothing)
β — fix/verify-password-accept-bearer  (BUG 5; depends on nothing; small)
γ — feat/files-folders-rename          (NEW + extension server check; depends on α merged for resolveByPrefix helper)
δ — chore/cli-whoami-cleanup           (UX #9; depends on nothing; smallest)
ε — docs/cli-refresh                   (depends on α + γ + δ merged; sweeps every doc)
```

α and β and δ can run in parallel.
γ waits for α (uses the same `resolveByPrefix` helper).
ε waits for γ + δ (so docs reflect final state).

## Verification

- After Piece 0 (Vercel env): web upload, web download, web preview/play, web drag-drop move (not copy), CLI upload, CLI download, CLI mv all work end-to-end against the preview.
- After α: `sonicbridge calendar edit <prefix> --title X` succeeds; `calendar rm <prefix>` succeeds; `discussion reply <prefix>` succeeds; `files rm <nonexistent-id>` fails fast with "File not found" before asking for password.
- After β: `sonicbridge files rm <existingId>` with correct password successfully deletes (no more false "Incorrect password.").
- After γ: `sonicbridge files rename <id> mix-final.wav` succeeds; renaming to `mix-final.mp3` returns 422; web rename UI shows inline editor + reflects 422 as a toast. `sonicbridge folders rename <id> "New Name"` works.
- After δ: `sonicbridge whoami` is a 3-line output, no projects table; `sonicbridge project ls` shows only id/name/role columns.
- After ε: each doc / help topic / cli/README mentions the new commands and the prefix rule.

## Out of scope (defer)

- Cycle-handling improvements for `rootOf` in `discussion ls` reply counts (an attribution bug under malformed server data only — covered in the original PR review and explicitly deferred).
- In-memory rate limit → DB rate limit (flagged for v2; not a feature-branch regression).
- Removing the `<tr draggable>` in favor of a dedicated drag handle (potential click-flakiness root cause for some browsers — only worth doing if BUG 1 turns out NOT to be the R2 env config issue once Piece 0 is done).
