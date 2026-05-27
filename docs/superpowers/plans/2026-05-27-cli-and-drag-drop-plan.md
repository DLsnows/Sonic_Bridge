# CLI + Drag-Drop — Implementation Plan

**Spec:** `docs/superpowers/specs/2026-05-27-cli-and-drag-drop-design.md`
**Main feature branch:** `feature/cli-and-drag-drop` (branched from `dev@ec6da45`)
**Workflow:** Each sub-task gets its own branch and PR **into `feature/cli-and-drag-drop`** (NOT into `dev`). The Claude Code Review action runs on those PRs. Owner merges sub-PRs after reviewing the action's comments + any other reviewers. The user previews the integrated feature branch locally, then decides whether to open a PR to `dev`.

## Sub-branch breakdown

### Sub-PR 1 — `feat/files-move-and-drag-drop`
Owner: agent **alpha**. Independent. Can start immediately.

Scope:
1. Add `PATCH /api/projects/[id]/files/[fileId]` accepting `{ folderId?: string|null, name?: string }`. Uses `authenticate()`. Validates the new folder belongs to the same project.
2. UI: extend `FileList.tsx`, `FolderTree.tsx`, `BreadcrumbNav.tsx`, `FileBrowser.tsx` with HTML5 drag-and-drop. Use `application/x-sb-file` as the drag MIME, fileId as the payload. Optimistic update, rollback toast on failure.
3. Tests: minimal Vitest for the PATCH handler (folder belongs to project / 404 wrong project / null sets to root).
4. PR title: `feat(files): drag-and-drop move + PATCH endpoint`.

### Sub-PR 2 — `feat/api-cli-coverage`
Owner: agent **beta**. Independent. Can start immediately.

Scope:
1. Add `isToken: boolean` to `AuthResult` in `lib/api-auth.ts`. Set `true` in the Bearer branch, `false` for session.
2. Convert Discussion routes (GET/POST + `[postId]` PATCH/DELETE) to use `authenticate()`. When `isToken` is true on POST/PATCH, write `isAiGenerated: true`.
3. Convert Schedule routes (GET/POST + `[eventId]` PATCH/DELETE) to use `authenticate()`. No AI flag here (events don't have one).
4. Add `authenticateUser(request)` (no project membership check) in `lib/api-auth.ts`. Add `GET /api/user/me` using it.
5. Add `POST /api/user/verify-password`. Create migration `0005_delete_challenges.sql` for `delete_challenges` table. Hash challenges with sha256 before storing. 5-min TTL, single-use, rate-limit 5/15min per user.
6. Modify `DELETE /api/projects/[id]/files/[fileId]` to require `X-Delete-Challenge` header. Atomic single-use claim (`UPDATE … WHERE used_at IS NULL RETURNING`).
7. Modify `DELETE /api/projects/[id]/folders/[folderId]` to reject non-empty folders with 409 `{ error: "folder_not_empty" }`. Drop the existing recursive descendant cleanup.
8. Settings UI rename: section heading "API Access" → "CLI Access"; helper copy mentions `sonicbridge` CLI; `GenerateToken.tsx` button "Generate API Token" → "Generate CLI Token".
9. Vitest for: token-flagged Discussion writes, verify-password rate limit, folder-not-empty rejection, challenge expiry.
10. PR title: `feat(api): token-aware discussion+schedule, cli auth surface, password challenge`.

### Sub-PR 3 — `feat/cli-core`
Owner: agent **gamma**. Independent for scaffold + login + files/folders (those endpoints are already token-aware). Calendar+discussion commands defer to sub-PR 4.

Scope:
1. `cli/` workspace with own `package.json` (name `sonicbridge`, bin `sonicbridge`), `tsconfig.json`, ESM build via `tsc`.
2. Deps: `commander`, `prompts` (interactive prompts), `kleur` or `picocolors` (color), `mime-types`, `progress`. No top-level network deps beyond Node's `fetch`.
3. `src/config.ts` — read/write `%APPDATA%/sonicbridge/config.json` on Windows / `~/.config/sonicbridge/config.json` elsewhere. First-run detection.
4. `src/api.ts` — `apiFetch(path, { method, body, project, headers })` adding `Authorization: Bearer <token>` and resolving relative paths against `config.baseUrl`. Pretty-prints API errors.
5. Commands shipped in this PR: `welcome` (first-run banner), `login`, `logout`, `whoami`, `project ls`, `project use`, `files ls/upload/download/mv/rm`, `folders ls/mkdir/rm`, `help`.
6. `files rm` uses the password-challenge flow (assumes sub-PR 2 is merged — this PR is opened AFTER sub-PR 2 merges).
7. Snapshot tests with Vitest for command parsing + config storage.
8. PR title: `feat(cli): scaffold + login/logout/files/folders`.

### Sub-PR 4 — `feat/cli-calendar-discussion`
Owner: agent **delta**. **Blocked by sub-PR 2** (calendar+discussion routes must be token-aware first). Starts after sub-PR 2 merges into the main feature branch.

Scope:
1. `cli/src/commands/calendar.ts` — `add`, `ls`, `edit`, `rm`. Accept ISO 8601 or `YYYY-MM-DD HH:mm` (parsed in the user's local TZ → toISOString before sending).
2. `cli/src/commands/discussion.ts` — `ls`, `read`, `post`, `reply`. Display `[AI]` prefix on rows where `isAiGenerated`.
3. Wire into commander root.
4. Update `cli/README.md` examples.
5. Vitest covering date parsing and `read` tree rendering.
6. PR title: `feat(cli): calendar + discussion commands`.

### Sub-PR 5 — `feat/cli-docs`
Owner: agent **epsilon**. **Blocked by sub-PR 3 AND sub-PR 4** (need the final command surface to document).

Scope:
1. `docs/cli/agent-usage.md` — comprehensive, agent-facing. Includes `--json` mode contract for every command.
2. `docs/cli/help.md` — long-form help text, what `sonicbridge help <topic>` prints.
3. `docs/cli/install-for-agents.md` — installation, token generation walkthrough, recommended agent settings snippet.
4. `docs/cli/README.md` — landing page that links the three.
5. Cross-link `cli/README.md` → `docs/cli/`.
6. PR title: `docs(cli): agent usage + help + install guide`.

## Dependency graph

```
Wave A (parallel, start immediately):
  alpha   → feat/files-move-and-drag-drop
  beta    → feat/api-cli-coverage
  gamma   → feat/cli-core (scaffold + non-delete commands; pauses on `files rm`
                           until beta lands or stubs it)

Wave B (after beta merges to feature/cli-and-drag-drop):
  gamma resumes `files rm` if not yet finished
  delta   → feat/cli-calendar-discussion

Wave C (after gamma + delta merge):
  epsilon → feat/cli-docs
```

## Coordination rules

- Each agent does its work in its own `git worktree` rooted at `feature/cli-and-drag-drop`. The Agent tool's `isolation: "worktree"` handles this automatically.
- Each agent commits + pushes its branch and opens its PR with `--base feature/cli-and-drag-drop` (NOT `dev`).
- After opening the PR the agent stops; orchestrator (this Claude session) watches PR comments — Claude Code Review action + any other reviewers — and either asks the agent to address them or merges via `gh pr merge`.
- No agent merges to `dev` or pushes to `dev`. Orchestrator never opens a PR to `dev` without user approval.
- Each agent is reminded of `AGENTS.md`: "This is NOT the Next.js you know — read `node_modules/next/dist/docs/` before writing code."

## Risk + rollback notes

- **DELETE folders behavior change** (sub-PR 2): previously cascaded; now rejects non-empty. Existing UI button "Delete folder and all its contents" must either (a) walk contents and delete them first, or (b) keep cascading server-side behind a separate `?recursive=true` query param. Default: refuse, and update the UI's confirm dialog + handler to do the walk so the user keeps the same UX. **Beta MUST update `FileBrowser.handleDeleteFolder` accordingly or document this in their PR.**
- **Drag-drop on touch**: HTML5 DnD doesn't work on mobile Safari. v1 is desktop-only; document in spec.
- **Token bearer + isAiGenerated**: if an existing automation already uses tokens to post to Discussion, their posts will start carrying AI badges. This is the intended behavior per the locked decision but call it out in the PR description.

## Out of scope (do not let agents drift into these)

- npm publish for `sonicbridge` package.
- New CI workflow for `cli/` (use existing `ci-lint-typecheck` if it covers the workspace; otherwise leave a TODO).
- `folders mv` command.
- Mobile drag-drop.
- Real-time discussion updates.
