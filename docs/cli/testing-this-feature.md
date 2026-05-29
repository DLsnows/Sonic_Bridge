# Testing checklist — `feature/cli-and-drag-drop`

End-to-end QA pass before promoting this branch to `dev`. Cover every shipped surface: files drag-and-drop, CLI auth + commands, password challenge, AI flag rule, folder-empty enforcement.

## Preview environments

- **Web preview (Vercel):** `https://sonic-bridge-git-feature-cli-and-drag-drop-dl-snows-projects.vercel.app` (auto-deployed on every push to this branch — confirm in Vercel dashboard before sending out)
- **CLI:** built locally from this branch's `cli/` directory.

## Setup

```sh
# In a fresh terminal
git checkout feature/cli-and-drag-drop
git pull
cd cli && npm install && npm run build && npm link
sonicbridge --help    # should print top-level help

# In the web preview:
#   1. Log in with a test account
#   2. Project Settings → CLI Access → Generate CLI Token
#   3. Copy the sb_... token

# Back in the terminal:
sonicbridge login     # paste the token at the hidden prompt
sonicbridge whoami    # confirms username + project memberships
sonicbridge project ls
sonicbridge project use <projectId-or-customId>
```

If `sonicbridge` is not on PATH after `npm link`, restart your shell or check `npm prefix -g`.

---

## A. Files drag-and-drop (web UI)

Prerequisite: pick a project that has at least 1 sub-folder and 2-3 files at the root.

| # | Action | Expected |
|---|---|---|
| A1 | Drag a file from the list onto a folder in the left-side tree | File disappears from current view; click into target folder → file is there |
| A2 | Drag a file onto its CURRENT folder | No-op, no flicker |
| A3 | Drag a file onto a parent in the breadcrumb | File moves to that parent |
| A4 | Drag a file onto the `Root` tree node | File moves to root |
| A5 | Hover-drag over a nested folder (entering child elements) | Highlight ring stays steady, does NOT flicker on/off as cursor crosses inner spans |
| A6 | Drag a file, then drop the page (release outside any drop target) | Source row returns to full opacity, nothing moves |
| A7 | While slow network (Chrome DevTools → Throttling → Slow 3G), drag a file → simulate API failure (drop server) | UI shows the file optimistically removed, then an `alert` rollback restores it without losing other concurrent changes |

## B. CLI auth + project selection

| # | Action | Expected |
|---|---|---|
| B1 | First-ever `sonicbridge` invocation in a fresh user account | Welcome banner prints once; subsequent invocations don't reprint |
| B2 | `sonicbridge login` with a malformed token (e.g. `sb_xxx`) | `Logged in` fails; exits 1 with a server error message |
| B3 | `sonicbridge login` valid + `--base-url` differs from previous | Old `activeProject` is cleared (test by `sonicbridge whoami` showing no active project) |
| B4 | `SONICBRIDGE_TOKEN=sb_yyy sonicbridge login --base-url <url>` | Logs in without prompting |
| B5 | `sonicbridge --token foo login` | Commander rejects: unknown option `--token` (token must NEVER be on argv) |
| B6 | `sonicbridge logout` then `sonicbridge whoami` | `Not logged in` error |
| B7 | `sonicbridge project use <invalid-id>` | Friendly error: not a member / not found |
| B8 | `sonicbridge whoami --json` | Valid JSON containing `user`, `projects`, `activeProject` |

## C. Files via CLI

| # | Action | Expected |
|---|---|---|
| C1 | `sonicbridge files ls` (root) | Lists root files |
| C2 | `sonicbridge files ls --folder <folderId>` | Lists files inside that folder |
| C3 | `sonicbridge files upload ./test.wav` | Progress bar appears; final `Uploaded test.wav (id: ...)`; web UI shows the file |
| C4 | `sonicbridge files mv <fileId> --to <folderId>` | File moves; web UI reflects |
| C5 | `sonicbridge files mv <fileId> --to root` | File moves to root |
| C6 | `sonicbridge files mv <fileId> --to <folderInDifferentProject>` | 404 (cross-project rejected) |
| C7 | `sonicbridge files download <fileId> --out ./out.bin` | File downloads bit-identical to upload |
| C8 | `sonicbridge files download <fileId> --out -` | Stream goes to stdout |
| C9 | Imagine a malicious server returning `Content-Disposition: filename="../../evil.bin"` | (Not easy to trigger live; covered by code-level `path.basename` sanitization. Confirm via reading `cli/src/commands/files.ts` ~line 240.) |
| C10 | `sonicbridge files rm <fileId>` | Password prompt; correct password → deleted; wrong password 6 times within 15 min → `429` rate-limited |
| C11 | After successful `files rm`, repeat `files rm` on the same id | 404 file not found (challenge NOT consumed — verified by code review of beta-fix) |

## D. Folders via CLI

| # | Action | Expected |
|---|---|---|
| D1 | `sonicbridge folders ls` (no arg) | Tree view of all folders |
| D2 | `sonicbridge folders ls <folderId>` | Files inside that folder |
| D3 | `sonicbridge folders mkdir "My Test Folder"` | Created at root, returns id |
| D4 | `sonicbridge folders mkdir "Sub" --parent <id>` | Nested folder created |
| D5 | `sonicbridge folders rm <emptyFolderId>` | Deleted successfully |
| D6 | `sonicbridge folders rm <folderWithFiles>` | 409 `folder_not_empty` with friendly message |
| D7 | `sonicbridge folders rm <folderWithSubfolders>` | 409 — sub-folder presence also counted |

## E. Calendar via CLI

| # | Action | Expected |
|---|---|---|
| E1 | `sonicbridge calendar add --title "Mix review" --start "2026-06-01 10:00" --end "2026-06-01 11:00"` | Created; web shows event |
| E2 | `sonicbridge calendar add` with end ≤ start | Client-side validation rejects before sending |
| E3 | `sonicbridge calendar add --start 2026-06-01T10:00:00Z --end 2026-06-01T11:00:00Z --type meeting` | ISO accepted; type set |
| E4 | `sonicbridge calendar ls` (no args) | Default 30-day window; lists upcoming events |
| E5 | `sonicbridge calendar ls --from 2026-06-01 --to 2026-06-30` | Filtered window |
| E6 | `sonicbridge calendar edit <eventId> --title "Updated"` | Title updated |
| E7 | `sonicbridge calendar edit <someoneElsesEvent>` as non-admin member | 403 with "Only the creator or a project admin..." (no duplicate error spam — `return` after `process.exit` verified) |
| E8 | `sonicbridge calendar rm <eventId>` as creator | Deleted |
| E9 | `sonicbridge calendar rm <invalidId>` | 404 friendly error |

## F. Discussion via CLI + AI flag visibility

| # | Action | Expected |
|---|---|---|
| F1 | `sonicbridge discussion post --title "Mix v3" --content "Bass +1.5dB"` | Thread created; CLI prints note about AI badge |
| F2 | Open browser → visit Discussion tab | The new thread shows an `[AI]` badge |
| F3 | Reply to that thread VIA WEB UI (session-authenticated) | Reply has NO `[AI]` badge |
| F4 | `sonicbridge discussion reply <threadId> --content "Reply via CLI"` | Reply has `[AI]` badge in web |
| F5 | `echo "piped" \| sonicbridge discussion post --title X --content -` | Content from stdin; works |
| F6 | `sonicbridge discussion ls` | Lists threads with `[AI]` markers on AI-flagged ones |
| F7 | `sonicbridge discussion read <threadId>` | Renders tree with `├──` for non-last siblings and `└──` for last |
| F8 | `sonicbridge discussion read <8charPrefix>` | Accepts prefix; same output |
| F9 | `sonicbridge discussion read <replyId>` | Walks up to thread root; prints full thread |

## G. Auth / security boundaries

| # | Action | Expected |
|---|---|---|
| G1 | Generate a NEW token in web; old token attempted via CLI | Old token 401 (regeneration invalidates the previous one) |
| G2 | `sonicbridge whoami` with a valid token for a project the user is NOT a member of | Project absent from `projects` list (correct — token only sees your memberships) |
| G3 | `curl -X DELETE` directly against `/api/projects/.../files/<id>` with token but no `X-Delete-Challenge` | 401 `challenge_required` |
| G4 | Re-use the same X-Delete-Challenge twice | Second call → 401 `challenge_invalid` |
| G5 | Wait 6 minutes after minting a challenge, then use it | 401 `challenge_invalid` (5-min TTL) |
| G6 | Attempt `verify-password` with Bearer token (not session) | 401 — endpoint is session-only by design |
| G7 | `verify-password` POST with 6 wrong attempts within 15 min | 429 rate-limited |
| G8 | Token leaks into shell history check: `history \| grep sb_` after a `sonicbridge login` session | Empty (token only via env or hidden prompt; no `--token` flag exists) |

## H. Settings UI rename

| # | Action | Expected |
|---|---|---|
| H1 | Project Settings page | Section heading reads "**CLI Access**" (not "API Access") |
| H2 | The button under it | Reads "**Generate CLI Token**" (not "Generate API Token") |
| H3 | Helper paragraph above the button | Mentions the `sonicbridge` CLI and links to `docs/cli/install-for-agents.md` |

## I. Documentation sanity

| # | Action | Expected |
|---|---|---|
| I1 | Open `docs/cli/README.md` — links to install/agent-usage/help | All three docs exist and links resolve |
| I2 | Every command in `cli/src/commands/` documented in `docs/cli/agent-usage.md` | Yes — verify by grep |
| I3 | `sonicbridge help calendar` prints the same as `docs/cli/help.md` calendar section | Mostly matches (minor formatting drift OK) |

## J. Negative / regression spot-checks

- J1: Existing Discussion features (web post / edit / delete by author) still work end-to-end (session auth path).
- J2: Existing Schedule features (web add / edit / delete) still work end-to-end.
- J3: Existing Files features (web upload via the upload zone, download, delete by author) still work.
- J4: Folder rename via web still works (PATCH /folders/<id> with `{name}`).
- J5: Existing drag-and-drop affordance for the upload zone (drag files INTO the upload zone) still works — this is the OLD drag-drop, separate from the new move-via-drag.

## K. Rename — CLI + Web (round 1 follow-up)

| # | Action | Expected |
|---|---|---|
| K1 | `sonicbridge files rename <prefix> mix-final.wav` (same ext) | Renamed; web reflects |
| K2 | `sonicbridge files rename <prefix> mix.mp3` (different ext) | 422; CLI prints `Extension cannot be changed (.wav → .mp3)` and exits 1 |
| K3 | `sonicbridge files rename <prefix-of-dotfile> .gitignore2` | Allowed (both treated as no-extension via `idx <= 0`) |
| K4 | `sonicbridge folders rename <prefix> "New Name"` | Renamed; web tree updates |
| K5 | Web: click rename icon on a file row, change name with same extension, Enter | Saved |
| K6 | Web: rename to a different extension, Enter | Blocked client-side before submit with toast `Extension cannot be changed` |
| K7 | Web: rapid double-rename of the same file (failure-then-success race) | Second rename is refused while first is in-flight (`renamingRef` guard); UI converges to the server-confirmed name |
| K8 | `sonicbridge files rename <ambiguous-prefix> X.wav` | `file prefix "<input>" is ambiguous (matches N). Use more characters or the full UUID.` |

## L. Prefix resolution (round 1 follow-up)

| # | Action | Expected |
|---|---|---|
| L1 | `sonicbridge calendar edit <8charPrefix> --title X` | Succeeds (resolved to full UUID before PATCH) |
| L2 | `sonicbridge calendar rm <8charPrefix>` | Succeeds |
| L3 | `sonicbridge discussion reply <8charPrefix> --content x` | Succeeds |
| L4 | `sonicbridge files rm <8charPrefix>` (existing file) | HEAD pre-flight passes; password prompt shows real file name |
| L5 | `sonicbridge files rm <nonexistent prefix>` | `No file matches "<input>".` exit 1 — NO password prompt |
| L6 | `PATCH /api/projects/<UUID>/schedule/not-a-uuid` direct | Returns 400 `Invalid event id` (not 500 anymore) |
| L7 | `sonicbridge files rm <correct-prefix>` then enter correct password | Verify-password 200, challenge minted, DELETE succeeds — BUG 5 regression check |

## M. Round 2 regressions

Operator pre-req for this section: the `delete_challenges` migration has been applied to the deployed Neon DB (orchestrator ran `drizzle/0005_delete_challenges.sql` via @neondatabase/serverless).

| # | Action | Expected |
|---|---|---|
| M1 | Open the Files page on a project with at least 1 file at root AND 1 file inside a folder | Root view shows ONLY the root file (round 2 BUG 1) |
| M2 | Click `* All Files` in the folder tree | Lists every file in the project, across all folders |
| M3 | Try to drag a file onto the `* All Files` entry | No-op (no API call) |
| M4 | Drag a file from folder A to folder B → drop | After the move PATCH resolves, the source row returns to full opacity immediately, no refresh needed (round 2 BUG 2) |
| M5 | Click play on an audio file → grab the seek bar and drag the playhead | Playhead moves; the file row does NOT begin a drag operation (round 2 BUG 3) |
| M6 | Same as M5 but for the volume slider | Volume changes; no drag triggered |
| M7 | Click rename pencil on a file | Input shows only basename (e.g. `mix`); gray `.wav` suffix shows to the right (round 2 BUG 4) |
| M8 | Try to click into the gray `.wav` label | Click does nothing (`pointer-events: none`) |
| M9 | Web file delete with correct password | DELETE succeeds (round 2 BUGS 5+6 with migration applied) |
| M10 | `sonicbridge files rm <prefix>` with correct password | DELETE succeeds via CLI |
| M11 | `sonicbridge project use <8charPrefix>` | Active project set; matches `project ls` (round 2 BUG 7) |
| M12 | `sonicbridge project use <customId>` | Active project set |
| M13 | Disable network mid-`sonicbridge files rm` to simulate server failure → verify the CLI prints "Server failed to mint a delete challenge (server-side error, not a password problem). Try again, or contact an admin." | 503 path triggers the friendly server-error message, not "Incorrect password" |

## What to do when something fails

If any of A-M fails, open an issue with:
- The exact step number (e.g. "C10", "K2", "L5", "M3")
- The full CLI output OR a screenshot for web
- The project ID + (if relevant) the file/folder/event/post id involved

For doc-only issues, just commit a fix directly to this branch — no need for a sub-PR at this stage.

## Sign-off

When all of A-M pass, this branch is ready to PR into `dev`. The PR title should be:

```
feat: files drag-and-drop + sonicbridge CLI (files / folders / calendar / discussion / docs)
```

The PR body should link this checklist and mention the 10 sub-PRs that landed: round 0 (#179, #180, #181, #184, #186), round 1 (#189, #190, #191, #192, #196), and round 2 (#197, #198, #199, #200, #201).
