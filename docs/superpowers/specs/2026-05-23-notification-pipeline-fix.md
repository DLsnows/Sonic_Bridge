# Notification Pipeline Fix: New Thread Detection

**Date:** 2026-05-23
**Status:** Approved

## Problem

When a user creates a new discussion thread, other project members see no unread badge or notification bell items. The source-table query approach (`SELECT FROM discussionPosts WHERE parentId IS NULL AND createdAt > last_viewed_at`) silently fails — likely due to `project_views` timestamp management or query comparison issues.

## Root Cause

New threads rely entirely on source-table queries comparing against `project_views.last_viewed_at`. There's no targeted notification row created for new threads (unlike replies, which get `reply_to_user` rows via `createReplyNotifications`). This means:

1. If the `project_views` timestamp is set too recently, all threads appear "read"
2. If no `project_views` row exists yet, the behavior depends on whether the `gt()` comparison is properly skipped — which may be inconsistent across DB drivers

## Fix: Create targeted notifications for new threads

When a new top-level thread is created, insert `new_post` notification rows for all project members except the author. This mirrors the existing `createReplyNotifications` pattern and eliminates dependency on source-table timestamp comparison for discussion activity.

### Changes

**`lib/notifications.ts`:**
- Add `createThreadNotifications()` function — fetches all project member IDs except the author, inserts `new_post` type notification rows

**`app/api/projects/[id]/discussion/route.ts`:**
- After creating a new thread (parentId === null), call `createThreadNotifications()`
- Already calls `createReplyNotifications()` for replies — keep both paths

**`app/api/notifications/route.ts` (GET):**
- Remove the source-table discussion threads query (section 2, lines 115-148)
- Keep `reply_to_user` notifications from the notifications table
- Keep source-table queries for files and events (these don't have high frequency and work correctly)

**`app/api/notifications/unread-counts/route.ts`:**
- Replace the source-table thread counting with notification-table counting (read `new_post` type unread notifications)
- Keep source-table counting for files and events
- Keep `reply_to_user` notification counting

**`lib/store/notification.ts`:**
- Add error logging to `fetchNotifications` and `fetchUnreadCounts` (replace silent `.catch {}` with `console.error`)

## Files Changed

| File | Change |
|------|--------|
| `lib/notifications.ts` | Add `createThreadNotifications()` |
| `app/api/projects/[id]/discussion/route.ts` | Call `createThreadNotifications()` for new threads |
| `app/api/notifications/route.ts` | Remove source-table thread query; rely on notification rows |
| `app/api/notifications/unread-counts/route.ts` | Count `new_post` notifications instead of source-table threads |
| `lib/store/notification.ts` | Add error logging |
