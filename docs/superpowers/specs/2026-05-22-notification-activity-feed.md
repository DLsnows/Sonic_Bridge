# Unified Activity Feed for Notifications — Design Spec

**Date:** 2026-05-22
**Status:** Approved
**Branch:** `fix/notification-activity-feed`

## Problem

Notifications show "No notifications" even when activity exists. Root cause: the notification system relies on write-time INSERTs into a `notifications` table, but "Recent Activity" queries source tables directly. Fire-and-forget notification creation silently fails, and existing data has no notification rows.

## Design

### Change 1: Rewrite GET /api/notifications — Unified Query

Instead of reading only the `notifications` table, UNION three source queries:

1. **Recent discussion threads** — `discussionPosts WHERE parentId IS NULL` for projects the user belongs to → type `new_post`
2. **Recent files** — `files` for user's projects → type `new_file`
3. **Upcoming/recent events** — `scheduleEvents` for user's projects → type `new_event`
4. **Targeted reply notifications** — rows from `notifications` table (only `reply_to_user` type) → type `reply_to_user`

Deduplicate by `(referenceType, referenceId, type)` so items that have both a source-table row and a notification row don't appear twice.

### Change 2: Expand reply_to_user to All Thread Participants

When a reply is posted, find ALL distinct users who have posted in that thread (ancestors + existing replies), not just the direct parent author. Insert one `reply_to_user` notification row per participant (excluding the actor).

### Change 3: Simplify createNotifications()

Remove generic batch inserts (`new_post`, `new_reply`, `new_file`, `new_event`). Keep only `reply_to_user` targeted insert. Add proper `await`.

### Change 4: Update NotificationBell

Update the dropdown to display richer data (titles, actor names) from the unified feed.

## Verification

1. Bell shows items matching the Recent Activity section
2. Replying to a thread notifies all previous participants
3. Creating a new thread/file/event appears in notifications for other members
4. No duplicate entries
