# CLI Bug-Bash Round 2 — Implementation Plan

**Spec:** `docs/superpowers/specs/2026-05-28-cli-bugfix-round-2-design.md`
**Main branch:** `feature/cli-and-drag-drop`
**Pre-req (USER):** apply the missing `delete_challenges` migration to the deployed Neon DB. Without it, BUGS 5 + 6 persist regardless of code changes. See spec Piece ζ.

## Sub-PR breakdown

### Sub-PR α — `fix/files-root-view-and-all-virtual`
Owner: agent **alpha**. Independent. Wave A.

Scope:
1. `app/api/projects/[id]/files/route.ts` GET: replace `folderId ? eq(...) : undefined` with explicit `isNull(files.folderId)` for root; honor `?all=1` query for the virtual "All Files" view.
2. `components/files/FolderTree.tsx`: add an "All Files" entry above the "Root" node. Carries a special selector value (e.g. `"__all__"`). Selecting it sets `currentFolderId` to a sentinel; visually distinct (subtle icon or color).
3. `components/files/FileBrowser.tsx`:
   - Track `currentView: { mode: "all" | "folder" }` derived from `currentFolderId`. When `__all__`, fetch `?all=1`; otherwise as today.
   - Disable drop on the "All Files" entry — `handleMoveFile` is a no-op when target is `__all__`.
   - The breadcrumb shows "All Files" when active.
4. Tests: `__tests__/files-list-folder-filter.test.ts` covering root (isNull), folderId match, all=1 returns full set.
5. PR title: `fix(files): root view shows only top-level files + add "All Files" virtual view`.

### Sub-PR β — `fix/drag-drop-artifacts`
Owner: agent **beta**. Independent. Wave A. UI-only.

Scope:
1. `components/files/FileList.tsx`:
   - Ensure `onDragEnd={() => setDraggingFileId(null)}` is on every draggable row.
   - Defensive: pass a callback prop `onMoveFinished` from `FileBrowser` that calls `setDraggingFileId(null)` after the move PATCH resolves (success or fail).
2. Audio player UI inside FileList rows: wrap with `<div draggable={false} onDragStart={(e) => { e.preventDefault(); e.stopPropagation(); }} onMouseDown={(e) => e.stopPropagation()}>`. Apply to the seek bar `<input type="range">` and volume slider too.
3. If `AudioPlayerModal.tsx` is rendered inside a draggable element, move it out to be a sibling of FileList (it already is, per FileBrowser layout — verify).
4. Tests: visual / interaction-only — no unit test required, but add a comment-level smoke test if the codebase has React Testing Library set up for this component.
5. PR title: `fix(files-ui): clear drag opacity after drop; isolate audio player from drag handlers`.

### Sub-PR γ — `fix/rename-ui-suffix-split`
Owner: agent **gamma**. Independent. Wave A. UI-only.

Scope:
1. `components/files/FileList.tsx`: rewrite the inline rename input:
   - Compute `baseName` and `extWithDot` from the current file's `name` (NOT hardcoded — pull from `file.name`).
   - For files with `.` only at the start (dotfiles), `extWithDot = ""`, `baseName = file.name`.
   - Render: `<input>` for basename, sibling `<span>` for the suffix label (gray text, `select-none`, `pointer-events-none`).
   - Submit handler concatenates `${baseName}${extWithDot}` and calls the existing `onRename(fileId, fullName)`.
2. Remove the previous client-side extension equality check — it's no longer reachable (the input physically can't change the suffix).
3. Tests: add a Vitest case (if RTL is wired up for this component) or at minimum a snippet documenting the new render shape.
4. PR title: `fix(files-ui): split filename into editable basename + uneditable extension label`.

### Sub-PR δ — `fix/cli-project-use-prefix`
Owner: agent **delta**. Independent. Wave A. CLI-only.

Scope:
1. `cli/src/commands/project.ts` `runProjectUse(input)`:
   - Fetch projects via `/api/user/me`.
   - Direct customId match wins.
   - Otherwise call `resolveByPrefix(input, async () => projects, "project")`.
   - Persist resolved project into `cfg.activeProject` and report:
     ```
     Active project set to <name> (<id-prefix>).
     ```
2. Tests in `cli/src/__tests__/project.test.ts`:
   - prefix match (8-char) succeeds.
   - full UUID succeeds.
   - customId succeeds.
   - ambiguous prefix gives the standard `resolveByPrefix` error.
3. PR title: `fix(cli): project use accepts prefix + customId + full UUID`.

### Sub-PR ζ — `fix/verify-password-error-envelope`
Owner: agent **zeta**. Independent. Wave A. **Code-side only — user-side migration is the actual unblock.**

Scope:
1. `app/api/user/verify-password/route.ts`:
   - Wrap challenge mint + cleanup + insert in `try { ... } catch (err)`.
   - On error: `console.error("[verify-password] mint failed:", err)`; return `503 { error: "challenge_mint_failed", message: "..." }`.
2. `cli/src/commands/files.ts` `runFilesRm`:
   - In the `catch` block around `verify-password`, add explicit `err.status === 503` handling: print friendly message ("Server failed to mint a delete challenge. Try again, or contact an admin.") and exit 1.
3. `components/files/FileBrowser.tsx` `handleDelete`:
   - Read response body's `error` field after non-2xx and branch:
     - `"Invalid password"` → toast/alert "Incorrect password."
     - `"challenge_mint_failed"` → "Server error minting challenge. Please try again."
     - everything else → "Could not start delete (HTTP <status>)."
4. Tests: extend `__tests__/verify-password*` with a "DB throws → 503 envelope" case using a mocked drizzle that throws on insert.
5. PR title: `fix(api+cli+web): clear 503 envelope for verify-password DB failures`.

### Sub-PR ε — `docs/cli-refresh-round-2`
Owner: agent **epsilon**. **Blocked by α + γ + δ + ζ merged**.

Scope:
1. `docs/cli/agent-usage.md`:
   - Add a sentence to `project use` saying it accepts prefix + customId + full UUID.
   - Mention the new "All Files" virtual view in the brief web-feature callout if one exists (otherwise skip — agent-usage is CLI-focused).
2. `docs/cli/help.md`: same `project use` update.
3. `docs/cli/testing-this-feature.md`: add section **M. Round 2 regressions** with one row per bug (root view, drag artifact, audio player drag, rename UX, project use prefix, delete password 500 → 503).
4. PR title: `docs(cli): document round 2 fixes`.

## Dependency graph

```
Wave A (parallel, immediate):
  α → fix/files-root-view-and-all-virtual    (BUG 1 + new virtual view)
  β → fix/drag-drop-artifacts                (BUGS 2 + 3)
  γ → fix/rename-ui-suffix-split             (BUG 4)
  δ → fix/cli-project-use-prefix             (BUG 7)
  ζ → fix/verify-password-error-envelope     (BUGS 5 + 6 hardening; complete fix needs user migration)

Wave B (after α + γ + δ + ζ merge):
  ε → docs/cli-refresh-round-2
```

## Coordination rules

- Same as round 1: each agent in its own worktree; base of every sub-PR is `feature/cli-and-drag-drop`; agents commit + push + open PR; orchestrator merges after review is clean.
- No agent merges to `dev` or pushes to `dev`.
- Every agent reads `AGENTS.md` first.

## Risk + rollback

- α changes the default "root view" semantics. If any client code relied on the old "no folderId = all files" behavior, it would break. Quick survey: `FileBrowser`, `FileList`, `FolderTree` are the only callers; CLI `files ls` uses `--folder` explicitly and passes through.
- β changes drag-event handlers on the audio player. Risk: a future audio control with its own drag (e.g. a custom scrubber) might need to call `stopPropagation` again. Low risk.
- γ replaces the rename input shape. Risk: keyboard navigation across the input+label boundary. Tab key behavior should still work — only the basename input is focusable.
- δ adds prefix resolution to `project use`. Risk: prefix collisions across projects. The same `resolveByPrefix` helper that handles this elsewhere applies here.
- ζ changes the HTTP error envelope. CLI and web both updated in this PR; no other callers exist.

## Out of scope

- Adding pagination to the new "All Files" view if a project has thousands of files.
- Replacing `<tr draggable>` with a dedicated drag handle (β's targeted stopPropagation should be sufficient).
- Folder rename UI changes.
- Running the migration on the user's behalf — that's a one-time operator action.
