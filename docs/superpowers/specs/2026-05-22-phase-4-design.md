# SonicBridge Phase 4 — Enhancement & Bug Fix Design

Date: 2026-05-22
Status: Approved

## Overview

3 independent workstreams executed on sub-branches, merged into `fix/phase-4`, then PR to `dev`. All 3 touch different files — zero merge conflicts.

---

## Workstream 1: R2 Storage Migration (`fix/phase-4-storage`)

### Problem
- Download returns `{"error":"Failed to download file..."}` — Vercel Blob signed URL expires before proxy completes
- Playback shows "Playback failed" — same root cause, Range requests break with expired URLs
- Upload works but uses complex two-phase flow (client-side upload + metadata POST + `/api/upload` token route)

### Solution
Replace Vercel Blob with Cloudflare R2 (S3-compatible API). Files stored in a **public** bucket — permanent URLs, no signed URL expiry, no server proxy needed.

### File Changes

| File | Action |
|------|--------|
| `lib/storage.ts` | Rewrite: `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`. New: `uploadFile()`, `getFileUrl()`, `deleteFile()`. Keep: `getStorageKey()`, `detectMimeType()`, `getMaxFileSize()`, `SIZE_LIMITS`. Remove: `saveFile()`, `getFileBody()`, `FileBodyResult`, `getFileUrl()` (old). |
| `app/api/projects/[id]/files/route.ts` (POST) | Revert to FormData multipart. `uploadFile()` → get public URL → insert DB record. No `/api/upload` token dance. |
| `app/api/projects/[id]/files/[fileId]/route.ts` (GET) | `head(storageKey)` → 302 redirect to public URL. No proxy/fetch/stream. |
| `app/api/projects/[id]/files/[fileId]/route.ts` (HEAD) | `head(storageKey)` → return metadata. |
| `components/files/FileList.tsx` | Audio playback: direct public URL `<audio src="..." />`. Remove API proxy path. |
| `components/files/FileBrowser.tsx` | Download: anchor element with direct public URL. Remove HEAD pre-flight. |
| `components/files/UploadZone.tsx` | Revert to simple FormData POST. Remove `@vercel/blob/client` `upload()` and progress tracking. |
| `app/api/upload/route.ts` | **DELETE** — no longer needed. |
| `components/files/types.ts` | Remove `url?: string` from FileItem. |
| `.env.local` | Add `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`. |
| `package.json` | Add `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`. Remove `@vercel/blob` if no other users. |

### New Upload Flow
1. Client: FormData POST to `/api/projects/[id]/files`
2. Server: `uploadFile()` → S3 PutObject to R2 → get public URL
3. Server: INSERT DB record with public URL as `storageKey`
4. Client: Refresh file list

### New Download Flow
1. Client: `<a href="/api/projects/[id]/files/[fileId]">`
2. Server: Look up `storageKey` (public URL), return 302 redirect
3. Browser: Fetches directly from R2 CDN

### New Playback Flow
1. Client: `<audio src="[public URL]" />` — uses `storageKey` directly
2. Browser: Streams from R2 CDN with native Range request support

### R2 Setup (Manual)
- Create R2 bucket (Standard, not public-binding initially — we generate public URLs via custom domain or `r2.dev`)
- Create API token with "Object Read & Write" permission
- Allow `r2.dev` subdomain for public access
- Add env vars to Vercel project

### Config Removal
- Remove `BLOB_READ_WRITE_TOKEN` from Vercel env after migration verified

---

## Workstream 2: Discussion Fixes (`fix/phase-4-discussion`)

### Problem 1: Thread Creation Fails
- Root cause: Migration `0002_funny_galactus.sql` never applied to Neon DB
- Column `is_ai_generated` missing → Drizzle `.returning()` references it → PG error → 500 → generic error message

### Solution: Apply Migration
- Use Neon MCP `run_sql` to execute: `ALTER TABLE discussion_posts ADD COLUMN IF NOT EXISTS is_ai_generated boolean DEFAULT false NOT NULL;`

### Problem 2: Color Audit
Remaining green/cyan references not caught in PR #129:

| File | Line | Current | Change |
|------|------|---------|--------|
| `PostForm.tsx` | 111 | `rgba(0,255,65,0.1)` (green) | `rgba(255,140,0,0.1)` (orange) |
| `ThreadCard.tsx` | 75, 81 | `text-[#00F0FF]` (cyan) | `text-[#FF8C00]` (orange) |
| `Modal.tsx` | 37 | `rgba(0,240,255,0.1)` (cyan) | `rgba(255,140,0,0.1)` (orange) |
| `Modal.tsx` | 39 | `neon-text-cyan` class | Add `titleClass` prop to ModalProps, default `"neon-text-cyan"`. Discussion passes `"text-[#FF8C00]"` |

Note: Adding `titleClass` prop to Modal (default `"neon-text-cyan"`) allows per-instance override without breaking other modals. No globals.css change needed.

### Problem 3: Modal Click-Outside Protection
- `Modal.tsx` always closes on overlay click
- New Thread modal needs this disabled

### Solution
- Add `closeOnOverlayClick?: boolean` to `ModalProps` (default `true`)
- Guard overlay onClick: `if (closeOnOverlayClick !== false && e.target === overlayRef.current) onClose()`
- DiscussionBoard: `<Modal closeOnOverlayClick={false} ...>`

### Problem 4: Draft Recovery
- Users lose typed content when accidentally closing New Thread modal

### Solution
- PostForm: on mount, check `localStorage.getItem('discussion-draft-${projectId}')`
- If found, populate form silently, show "草稿已恢复" hint
- On title/content change: debounce 300ms, save to localStorage
- On successful submit: clear localStorage
- On explicit "Cancel" via button: keep draft (user can come back)

### File Changes
| File | Action |
|------|--------|
| `app/api/projects/[id]/discussion/route.ts` | Verify no code changes needed after migration |
| `components/discussion/PostForm.tsx` | Fix focus shadow + localStorage draft save/restore |
| `components/discussion/ThreadCard.tsx` | Fix code block colors |
| `components/ui/Modal.tsx` | Add `closeOnOverlayClick` prop |
| `components/discussion/DiscussionBoard.tsx` | Pass `closeOnOverlayClick={false}` to New Thread modal |
| `app/globals.css` | Add `neon-text-orange` class if needed |

---

## Workstream 3: Notification Click-Outside (`fix/phase-4-notif`)

### Problem
Notification dropdown only closes by clicking a notification item or toggling the bell button. Clicking anywhere else on page leaves it open.

### Solution
- `useRef` for dropdown container + bell button
- `useEffect` with `mousedown` listener on `document` when dropdown is open
- If click target is NOT inside dropdown ref AND NOT on bell button → close
- Clean up listener when dropdown closes or component unmounts

### File Changes
| File | Action |
|------|--------|
| `components/NotificationBell.tsx` | Add refs + useEffect for click-outside detection |

---

## Branch Strategy
```
fix/phase-4-storage ──┐
fix/phase-4-discussion ──┼──▶ fix/phase-4 ──▶ PR to dev
fix/phase-4-notif ──────┘
```

## Execution Order
1. Create `fix/phase-4` from dev
2. Create 3 sub-branches from fix/phase-4
3. Phase 1 (parallel): 3 agents work simultaneously
4. Phase 2: Merge sub-branches → fix/phase-4
5. Phase 3: PR fix/phase-4 → dev, 5-iteration review loop
6. Phase 4: User approval → merge to dev

## Verification
| # | Test | Expected |
|---|------|----------|
| 1 | Create discussion thread | No error, thread appears |
| 2 | Discussion UI | All orange #FF8C00, no green/cyan |
| 3 | New Thread modal | Doesn't close on overlay click |
| 4 | New Thread modal | Closes on Escape |
| 5 | Draft recovery | Close modal → reopen → content restored with hint |
| 6 | Notification dropdown | Closes on click-outside |
| 7 | Upload audio file | Uploads successfully |
| 8 | Play audio | Plays with seeking |
| 9 | Download file | Correct filename, works |
| 10 | Upload Files button | Green #00FF41 |
| 11 | TypeScript | `npx tsc --noEmit` passes |
| 12 | No Vercel Blob deps | `@vercel/blob` removed or unused |
