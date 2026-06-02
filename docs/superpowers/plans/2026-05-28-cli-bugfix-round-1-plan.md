# CLI Bug-Bash Round 1 — Implementation Plan

**Spec:** `docs/superpowers/specs/2026-05-28-cli-bugfix-round-1-design.md`
**Main branch:** `feature/cli-and-drag-drop` (sub-PRs all land here)
**Pre-req (USER):** add 5 `R2_*` env vars to Vercel **Preview** scope (see spec Piece 0). Without that, BUGS 1-4 will still surface even after this round merges. No code PR for that.

## Sub-PR breakdown

### Sub-PR α — `fix/cli-prefix-and-rm-preflight`
Owner: agent **alpha**. Independent. Starts immediately.

Scope:
1. New `cli/src/util/resolve-id.ts` with `resolveByPrefix<T extends { id: string }>(input, fetchAll, label)`. Exact-id match wins; otherwise unique-prefix match; otherwise descriptive error.
2. `cli/src/commands/calendar.ts`: `runCalendarEdit` and `runCalendarRm` resolve `eventId` against a wide-window `fetchAllEvents` call before sending PATCH/DELETE.
3. `cli/src/commands/discussion.ts`: `runDiscussionReply` resolves `parentPostId` against the project's discussion list before sending POST. Optional: refactor `runDiscussionRead`'s inline lookup to use the new util (consistency only — current behavior already correct).
4. `cli/src/commands/files.ts`: `runFilesRm` (a) resolves `fileId` prefix using a `files ls` fetch, (b) HEAD `/files/<id>` before any password prompt; on 404 print friendly error and exit 1.
5. Server hygiene: `app/api/projects/[id]/schedule/[eventId]/route.ts` PATCH+DELETE wrap drizzle calls in try/catch and validate `eventId` shape via the existing `UUID_RE` from `lib/project-utils.ts`. Return 400 "Invalid event id" instead of 500 on bad input.
6. Tests:
   - `cli/src/__tests__/resolve-id.test.ts` — exact, unique prefix, no match, ambiguous.
   - `cli/src/__tests__/files-rm.test.ts` — HEAD 404 short-circuits before password prompt; HEAD 200 + valid challenge succeeds (mock the verify-password call).
   - Server-side: `__tests__/schedule-bad-uuid.test.ts` — PATCH/DELETE with non-UUID `eventId` returns 400.
7. PR title: `fix(cli+api): prefix resolution + rm pre-flight + schedule 500→400 hardening`.

### Sub-PR β — `fix/verify-password-accept-bearer`
Owner: agent **beta**. Independent. Starts immediately. Small.

Scope:
1. `app/api/user/verify-password/route.ts`: replace `const session = await auth(); if (!session?.user) ...` with `const auth = await authenticateUser(request); if (auth instanceof Response) return auth;`. Use `auth.userId` everywhere the old code used `session.user.id`.
2. Update the file's comment block — the old comment says "session-only — a leaked Bearer must NOT mint a delete challenge." Replace with: "accepts both session and Bearer. The challenge guards against UI-mode attacks (XSS / stolen session); a Bearer leak already grants unrestricted DELETE/PATCH/POST, so a separate challenge offers no incremental defense, but the rate-limit (5/15min/user) and one-shot semantics still bound damage."
3. Tests: extend `__tests__/verify-password.test.ts`:
   - Bearer call with correct password → 200, challenge returned.
   - Bearer call with wrong password → 401, rate-limit counter incremented.
   - Session call still works (existing tests).
   - Rate-limit triggers across both auth modes (mix bearer + session calls).
4. PR title: `fix(api): verify-password accepts Bearer so CLI files rm can succeed`.

### Sub-PR γ — `feat/files-folders-rename`
Owner: agent **gamma**. **Blocked by α merge** (uses `resolveByPrefix` helper).

Scope:
1. **Server-side extension check** in `app/api/projects/[id]/files/[fileId]/route.ts` PATCH handler: when `parsed.data.name !== undefined`, compute `currentExt` from `file.name` and `newExt` from `parsed.data.name`. If they differ, return `422 { error: "extension_change_not_allowed", currentExt, newExt }`. Tests in `__tests__/files-patch.test.ts`.
2. **CLI `files rename`:**
   - New `runFilesRename(fileIdOrPrefix, newName, flags)` in `cli/src/commands/files.ts`.
   - Resolve prefix via `resolveByPrefix`.
   - Client-side checks: non-empty, ≤200 chars, no `/`/`\`/control.
   - Warn (not block) if newName has no extension or differs in extension; let server be authoritative.
   - PATCH `/files/<id>` with `{ name }`; surface 422 with the actual extensions.
   - Wire into commander as `files rename <fileId> <newName>` in `cli/src/index.ts`.
3. **CLI `folders rename`:**
   - New `runFoldersRename(folderIdOrPrefix, newName, flags)` in `cli/src/commands/folders.ts`.
   - Resolve prefix via `resolveByPrefix`.
   - PATCH `/folders/<id>` with `{ name }`.
   - Wire as `folders rename <folderId> <newName>`.
4. **Web file rename UI** in `components/files/FileList.tsx`: pencil icon next to download/delete; click opens an inline `<input>` (or `Modal` if simpler). Enter submits → calls `handleRenameFile(fileId, newName)` in `FileBrowser.tsx`. Validate extension client-side; on 422 from server, surface a toast like "Extension cannot be changed (.wav → .mp3)".
5. Help + topic blocks: add `rename` entries to the `files` and `folders` `*_HELP` blocks in `cli/src/commands/help.ts` (or wherever they're colocated).
6. Tests:
   - `cli/src/__tests__/files-rename.test.ts`, `folders-rename.test.ts` — commander parsing + happy path + 422 path.
   - Extension test in `__tests__/files-patch.test.ts`.
7. PR title: `feat(cli+web): rename files and folders (with extension protection)`.

### Sub-PR δ — `chore/cli-whoami-cleanup`
Owner: agent **delta**. Independent. Smallest. Starts immediately.

Scope:
1. `cli/src/commands/whoami.ts`: drop the projects render block from human output. New shape:
   ```
   Logged in as <username> (<email>)
   Active project: <name> (<id-prefix>)   # only if activeProject is set
   Run `sonicbridge project ls` to see your projects.
   ```
   `--json` output keeps `projects` for back-compat.
2. `cli/src/commands/project.ts`: remove the `customId` column from the human table (id, name, role). JSON unchanged.
3. Update tests in `cli/src/__tests__/whoami.test.ts` and `project.test.ts`.
4. PR title: `chore(cli): trim whoami output; project ls drops customId column`.

### Sub-PR ε — `docs/cli-refresh`
Owner: agent **epsilon**. **Blocked by α + γ + δ merged**.

Scope:
1. `docs/cli/agent-usage.md`: add a top-level "Prefix resolution rule" subsection right after "Conventions" — "Every command that takes an id accepts a unique 8-char prefix OR the full UUID." Add `files rename` + `folders rename` command sections. Update `whoami` and `project ls` output examples to match the new trimmed shape.
2. `docs/cli/help.md`: same updates as agent-usage but trimmed to the CLI's built-in help style. Verify each topic matches the actual `*_HELP` blocks in `cli/src/commands/`.
3. `docs/cli/install-for-agents.md`: no command-surface changes needed, but the recommended `.claude/settings.json` allowlist should add `Bash(sonicbridge files rename *)`, `Bash(sonicbridge folders rename *)` to the safe-ish list (with a note that rename can clobber names). Actually — rename is mutating, so DON'T allowlist; just add a note that it exists.
4. `cli/README.md`: extend the commands table to include the rename rows.
5. `docs/cli/README.md`: small note in 30-second taste section showing one rename example.
6. Verification: grep `cli/src/commands/` for every exported `run*` function and confirm each one is documented.
7. PR title: `docs(cli): document prefix rule + file/folder rename`.

## Dependency graph

```
Wave A (parallel, start immediately):
  α → fix/cli-prefix-and-rm-preflight   (BUGS 6, 7, 8)
  β → fix/verify-password-accept-bearer (BUG 5)
  δ → chore/cli-whoami-cleanup          (UX #9)

Wave B (after α merges):
  γ → feat/files-folders-rename         (uses resolveByPrefix from α)

Wave C (after γ + δ merge):
  ε → docs/cli-refresh                  (final doc sweep)
```

## Coordination rules

- Same as round 0: each agent gets its own worktree (isolation: worktree on Agent tool).
- Base for every sub-PR is `feature/cli-and-drag-drop` (NOT dev).
- Agents commit + push their branch and open the PR via `gh pr create --base feature/cli-and-drag-drop`.
- After opening PR the agent stops; the orchestrator (this session) watches review/CI checks and either dispatches a fix-up agent or merges via `gh pr merge`.
- No agent merges to `dev` or pushes to `dev` without explicit user OK.
- Each agent reads `AGENTS.md` + the spec (`docs/superpowers/specs/2026-05-28-cli-bugfix-round-1-design.md`) before writing code.

## Risk + rollback

- **Piece β changes auth model on a security-sensitive endpoint.** Reviewer eyes recommended. Risk is bounded: token already grants full access; this just adds one more thing the token can do (mint a one-shot challenge), which it could already do indirectly via the DELETE endpoint anyway after a session-mode flow. Rollback if needed: single-line revert of the auth swap.
- **Piece α's server change** (uuid regex guard on schedule) is purely defensive — 400 instead of 500 — no behavior change for valid clients.
- **Piece γ extension lock** could break agents that previously renamed via raw API. Quick survey: nothing in the codebase calls PATCH file with `name` change. Web UI doesn't currently expose rename for files (folder rename has no extension). New behavior, no migration risk.
- **Piece δ** removes columns from human output. Agent automation that screen-scrapes will break. Mitigation: documented JSON shape is unchanged; agents that want structured data must use `--json`. Spec calls this out in the verification step.

## Out of scope

- Vercel env config (user action, no code).
- `<tr draggable>` rework — only revisit if BUG 1 persists after the env fix.
- Cycle-handling improvements for `rootOf` in `discussion ls` reply counts.
- In-memory rate limit → DB rate limit.
- Adding `verify-password` per-token cap (current global per-user cap covers both modes).
