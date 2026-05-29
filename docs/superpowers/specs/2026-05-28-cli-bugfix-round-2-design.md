# CLI Bug-Bash Round 2 — Design Spec

**Date:** 2026-05-28
**Status:** Draft (awaiting Vercel logs for the password endpoint before sub-PR ζ can be specified)
**Main branch:** `feature/cli-and-drag-drop`

## Background

Round 2 of user QA found 7 issues + 1 confirmation. Round 1 fixed BUGS 5/6/7/8 (password + prefix bugs). Round 2 is the new batch.

## Locked decisions (from brainstorm)

| Decision | Choice |
|---|---|
| `project use` ID input | Accepts prefix, customId, OR full UUID (consistent with `calendar`, `files`, `discussion`, etc.). |
| Rename UI suffix handling | Input box only contains the basename; the actual extension (e.g. `.mp3`) is rendered to the right of the input as an unselectable gray suffix label. The extension shown must come from the file's actual name — never hardcoded. |
| Root view | (a) Fix the API so root = `folderId IS NULL` only. (b) Add an "All Files" virtual top-level option in the folder tree; selecting it lists every file in the project across all folders. |
| Password endpoint diagnosis | User-provided Vercel logs (no diagnostic agent). |

## Confirmation answered to user

The password the CLI/Web asks for is the user's **login password** (the same one used at sign-in). Server compares with `bcryptjs.compare` against `users.passwordHash` — identical bcrypt comparison NextAuth uses at login. They cannot drift.

## Pieces

### Piece A — Root view returns only top-level files (BUG 1)

**Problem:** `GET /api/projects/<p>/files` (no `folderId` query param) currently returns every file in the project, regardless of folder. Looking at the GET handler:

```ts
const folderId = request.nextUrl.searchParams.get("folderId");
const fileList = await db.select(...).from(files).where(and(
  eq(files.projectId, id),
  folderId ? eq(files.folderId, folderId) : undefined,
));
```

When `folderId` is null, no filter is applied → all project files returned.

**Fix:** Replace the conditional with an explicit `isNull` for root. Add a new query param `all=1` (or `folderId=__all__`) for the "All Files" virtual view.

```ts
const folderIdParam = request.nextUrl.searchParams.get("folderId");
const wantsAll = request.nextUrl.searchParams.get("all") === "1";
const fileList = await db.select(...).from(files).where(and(
  eq(files.projectId, id),
  wantsAll
    ? undefined
    : folderIdParam
    ? eq(files.folderId, folderIdParam)
    : isNull(files.folderId),
));
```

Update `components/files/FolderTree.tsx` to render an "All Files" entry above the existing tree (after "Root"). Selecting it sets a new state (e.g. `currentView: "root" | "all" | <folderId>`) and `FileBrowser` fetches with `?all=1`. The new view does not accept drops (moving a file to "All" is meaningless).

Add a `__tests__/files-list-folder-filter.test.ts` covering: no folderId → only NULL files; folderId=<id> → only that folder; all=1 → all files.

**CLI impact:** the prefix-resolution helper for `files rm` walks every folder; that walk should also include the root files (it does — `folderIds = [null, ...]`). No CLI change required, but verify the helper still resolves to the correct file count after the API change.

### Piece B — Drag-end opacity stuck after drop (BUG 2)

**Problem:** dragged file row stays at `opacity-50` until browser refresh. Either `setDraggingFileId(null)` is missing in the drop flow, or the dragend event isn't firing on Chrome when a successful drop occurs cross-element.

**Fix in `components/files/FileList.tsx`:**

- The row sets `setDraggingFileId(fileId)` on `dragstart`. Ensure `setDraggingFileId(null)` is called in `dragend` AND `drop` (belt-and-suspenders).
- Also reset on the move-handler's promise resolution in `FileBrowser.handleMoveFile` (so even if dragend swallowed by some browsers, success/failure clears state).

```tsx
const handleDragStart = (e, fileId) => {
  e.dataTransfer.setData(SB_FILE_MIME, fileId);
  setDraggingFileId(fileId);
};
const handleDragEnd = () => setDraggingFileId(null);
```

If a `drop` handler upstream already triggers a re-render that removes the dragged row from the current view, `dragend` may never fire. Defensive: on the FileBrowser side, after `handleMoveFile` resolves OR rejects, dispatch a `dragend` reset via a callback prop:

```tsx
<FileList onMoveFinished={() => setDraggingFileId(null)} ... />
```

### Piece C — Audio player drag conflict (BUG 3)

**Problem:** The inline audio player (or AudioPlayerModal) lives inside a draggable element. Dragging the seek bar slider initiates HTML5 drag and the browser interprets it as a file move.

**Fix:** make the audio player UI explicitly opt out of HTML5 drag.

In `components/files/FileList.tsx`, wrap the audio player block with:

```tsx
<div
  draggable={false}
  onDragStart={(e) => { e.preventDefault(); e.stopPropagation(); }}
  onMouseDown={(e) => e.stopPropagation()}
>
  ...player markup...
</div>
```

Same wrapping for the seek bar `<input type="range">` and the volume slider. `onMouseDown stopPropagation` prevents the browser from bubbling drag intent up to the row.

If `AudioPlayerModal.tsx` is rendered (modal mode), it lives as a sibling of `FileList` so it's not affected. But verify: if it's positioned absolutely INSIDE a row, move it out.

### Piece D — Rename UI: editable basename + uneditable suffix label (BUG 4)

**Problem:** current inline rename shows the whole filename including `.wav` inside the editable input. User must manually keep the extension intact.

**Fix in `components/files/FileList.tsx`:**

Replace the single `<input>` with a wrapper:

```tsx
<span className="inline-flex items-center gap-0">
  <input
    type="text"
    value={baseName}                       // basename only
    onChange={(e) => setBaseName(e.target.value)}
    onKeyDown={...}
    onBlur={...}
    className="..."
    autoFocus
  />
  <span className="text-[#A0A0B0] select-none">
    {extWithDot}                            {/* ".wav" — derived from current file, not hardcoded */}
  </span>
</span>
```

Where `baseName = file.name.replace(/\.[^.]+$/, "")` and `extWithDot = file.name.match(/\.[^.]+$/)?.[0] ?? ""`. For dotfiles (`.gitignore`), `baseName = ".gitignore"` and `extWithDot = ""` (no second dot).

On submit, send `${baseName}${extWithDot}` to the PATCH endpoint. No client-side extension check needed anymore — the input physically cannot change the suffix. The server's 422 guard stays as a defense-in-depth.

For files with no extension (e.g. `README`), `extWithDot = ""` and the suffix label is empty.

Make sure the suffix label is `user-select: none` and `pointer-events: none` so clicking it doesn't change focus or selection.

### Piece E — `project use` accepts prefix + customId + UUID (BUG 7)

**Problem:** `project ls` shows 8-char prefix; `project use` only accepts full UUID/customId. User has no way to obtain the full UUID via CLI without `--json` parsing.

**Fix in `cli/src/commands/project.ts` `runProjectUse`:**

Use the same `resolveByPrefix` helper from round 1:

```ts
import { resolveByPrefix } from "../util/resolve-id.js";

export async function runProjectUse(input: string): Promise<void> {
  // ... existing config load + /me fetch returning projects: [{id, customId, name, role}] ...
  const projects = await fetchMyProjects();

  // Direct customId match (case-sensitive) wins first.
  const byCustomId = projects.find((p) => p.customId === input);
  if (byCustomId) return persist(byCustomId);

  // Otherwise use prefix resolution against the id field.
  const match = await resolveByPrefix(
    input,
    async () => projects,
    "project",
  );
  return persist(match);
}
```

Tests in `cli/src/__tests__/project.test.ts`: prefix match, full UUID match, customId match, ambiguous prefix.

### Piece F — Sweeping doc + help sync

After A–E land, sweep:
- `docs/cli/agent-usage.md`: `project use` accepts prefix + customId + UUID.
- `docs/cli/help.md`: same.
- `docs/cli/testing-this-feature.md`: add new section "M. Round 2 regressions" with one row per bug.
- Web rename UX is invisible to docs — no change needed beyond a one-liner in agent-usage that the web UI now separates extension from the editable region.

### Piece ζ — verify-password 500 hardening + clear error envelope (BUGS 5 + 6)

**Root cause (confirmed from browser console + reading route + migration journal):**

The `delete_challenges` table was added to `lib/db/schema.ts` and to `drizzle/0005_delete_challenges.sql` in round 0 (PR #180), but **the migration was never applied to the deployed Neon database**. Vercel does not auto-run drizzle migrations. When the route reaches `await db.insert(deleteChallenges).values({...})` at `app/api/user/verify-password/route.ts:135`, Postgres throws `relation "delete_challenges" does not exist`, the unhandled rejection propagates to Next.js, and the response is a bare 500.

Both auth modes hit the same path:
- Web (session): `FileBrowser.handleDelete` reads any non-2xx as "Incorrect password." — the UI mis-attributes the 500 to a credential error.
- CLI (Bearer): `runFilesRm` correctly distinguishes statuses but the CLI's `apiFetch` wrapper surfaces raw `API error 500`.

The cleanup `DELETE FROM delete_challenges ...` query at line 125 also runs against the missing table but is wrapped in `.catch(() => {})` and silently fails — that's why no error surfaces from cleanup, only from the insert.

**Operator action (user, one-time):** apply the migration to the deployed DB:
```
DATABASE_URL='<your Neon prod connection string>' npx drizzle-kit migrate
# OR paste drizzle/0005_delete_challenges.sql into Neon SQL Editor
```

**Code-side hardening (this PR), so the next missing-migration / DB-down moment doesn't look like a credential bug:**

1. Wrap the challenge mint + insert (lines 117-139) in a single `try { ... } catch (err)`. On error, `console.error("[verify-password] mint failed:", err)` and return:
   ```ts
   return NextResponse.json(
     { error: "challenge_mint_failed", message: "Could not mint a delete challenge. Try again, or contact an admin if this persists." },
     { status: 503, headers: { "Cache-Control": "no-store" } },
   );
   ```
2. Update `cli/src/commands/files.ts` `runFilesRm` to catch 503 with `challenge_mint_failed` specifically and surface: `"Server failed to mint a delete challenge (server-side error, not a password problem). Try again, or contact an admin."` — distinct from "Incorrect password.".
3. Update `components/files/FileBrowser.tsx` `handleDelete` similarly: on non-2xx from verify-password, check `data.error`:
   - `"Invalid password"` → "Incorrect password."
   - `"challenge_mint_failed"` → "Server error minting challenge. Please try again."
   - everything else → "Could not start delete (HTTP <status>)."
4. Tests: assert the 503 path returns the correct shape; assert CLI/Web error-mapping logic.

**Verification after Piece ζ AND migration applied:**
- Web file delete with correct password succeeds.
- CLI `sonicbridge files rm` with correct password succeeds.
- If the table is ever missing in the future, the user sees "Server error minting challenge", not "Incorrect password."

## Sub-PR breakdown

```
α — fix/files-root-view + all-files-virtual-view (BUG 1 + new virtual view)
β — fix/drag-drop-artifacts (BUGS 2 + 3) — small UI-only
γ — fix/rename-ui-suffix-split (BUG 4) — UI-only
δ — fix/cli-project-use-prefix (BUG 7) — CLI-only
ζ — fix/verify-password-bug (BUGS 5 + 6) — WAITING for logs
ε — docs/cli-refresh-round-2 — last, after the rest merge
```

α, β, γ, δ can run in parallel.
ζ blocked on user-provided Vercel logs.
ε blocked on α + γ + δ + ζ.

## Verification

After Piece A: root view shows only top-level files; clicking "All Files" shows everything. Confirmed: `sonicbridge folders ls` unchanged; CLI walk for `files rm` still resolves prefixes correctly.
After Piece B: dragging a file then dropping it — the source row returns to full opacity immediately, no refresh needed.
After Piece C: opening the audio player in a row, grabbing the seek bar and dragging the playhead does not initiate a file move.
After Piece D: clicking the rename pencil shows an input with only the basename; `.wav` appears to the right as gray text; impossible to delete `.wav` accidentally; submitting saves `<basename>.wav`. Renaming `.gitignore` works (basename = `.gitignore`, no suffix shown).
After Piece E: `sonicbridge project use <8charPrefix>` works; `sonicbridge project use <customId>` works; `sonicbridge project use <fullUUID>` works; ambiguous prefix gives a clear error.
After Piece ζ: `sonicbridge files rm <id>` with correct password succeeds; web file delete with correct password succeeds.

## Out of scope

- Pagination on root/all view if the project has 1000+ files (defer).
- Drag-handle dedicated icon instead of full-row drag (BUG 3 fix is sufficient; revisit if more drag conflicts surface).
- Folder rename UI changes (no spec change requested for round 2).
