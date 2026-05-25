# SonicBridge — Frontend Interaction Reference

> Complete inventory of every interactive element across all pages.
> Use this as a checklist when refactoring to ensure no functionality is lost.
>
> **Last updated:** 2026-05-23 (against branch `fix/notification-pipeline`)

---

## 1. Login Page (`/(auth)/login`)

| Element | Type | Function |
|---------|------|----------|
| Email input | Text field | Enter email address |
| Password input | Password field | Enter password |
| **Sign In** | Submit button | POST credentials to NextAuth, redirect to `/` on success, show error on failure |
| **Create one** | Link | Navigate to `/register` |

---

## 2. Register Page (`/(auth)/register`)

| Element | Type | Function |
|---------|------|----------|
| Username input | Text field | Min 2 chars |
| Email input | Text field | |
| Password input | Password field | Min 8 chars |
| **Create Account** | Submit button | POST `/api/register`, redirect to `/login?registered=true` on success |
| **Sign in** | Link | Navigate to `/login` |

---

## 3. Dashboard / Project List (`/`)

### Top Bar

| Element | Type | Function |
|---------|------|----------|
| **+ New Project** | Button (primary) | Opens create project modal |
| **Join Project** | Button (secondary) | Opens join project modal |

### Create Project Modal
No custom ID field — only name and description.

| Element | Type | Function |
|---------|------|----------|
| Project Name input | Text field | Required |
| Description input | Text field | Optional |
| **Cancel** | Button | Close modal, reset form |
| **Create** | Button | POST `/api/projects`, navigate to new project on success |

### Join Project Modal

| Element | Type | Function |
|---------|------|----------|
| Project ID input | Text field | UUID or custom ID of project to join |
| **Cancel** | Button | Close modal |
| **Join** | Button | POST `/api/projects/join`, refresh page on success |

### Inactive Projects Section (archived/paused)

| Element | Type | Function |
|---------|------|----------|
| **▶ Archived / Paused (N)** | Toggle button | Expand/collapse list of inactive projects |
| Inactive project card | Link | Navigate to project, rendered at reduced opacity |

### Active Project Grid

| Element | Type | Function |
|---------|------|----------|
| Project card | Link (with `ProjectCardWrapper`) | Navigate to `/projects/[id]`. Shows unread notification badge if present. Clicking clears unread count for that project. |
| **ProjectStatusBadge** | Badge (non-interactive here) | Shows project status (Not Started / In Progress / Paused / Pending Release / Archived) |

---

## 4. Sidebar (present on all authenticated pages)

### Logo & Collapse

| Element | Type | Function |
|---------|------|----------|
| **SONICBRIDGE** | Link | Navigate to `/` |
| **◀ / ▶** | Toggle button | Collapse/expand sidebar |

### Navigation

| Element | Type | Function |
|---------|------|----------|
| **Projects** (◈) | Link | Navigate to `/`, highlighted when on `/` |
| **Project item** (per project) | Link | Navigate to `/projects/[id]`. Shows colored status dot and project name. Shows red unread notification badge if present. Clicking clears unread count for that project. |
| Status dot | Display | Colored dot indicating project status: gray=Not Started, green=In Progress, amber=Paused, cyan=Pending Release, red=Archived |

### Notification Bell

| Element | Type | Function |
|---------|------|----------|
| **Notification bell** 🔔 | Toggle button | Open/close notification dropdown. Shows red badge with unread count. Polls every 30s. |
| **Mark all read** | Button (inside dropdown) | Marks all notifications read via PATCH `/api/notifications` + PATCH `/api/notifications/view` |
| Notification item | Clickable row | Navigate to the referenced item (post/event/file) via query param. Marks that single notification as read if persistent type. |
| **✓** (per notification) | Button | Mark individual notification as read without navigating |

**Notification types:** new_post, new_reply, reply_to_user, new_event, new_file — each with distinct icon and label.

### User Section

| Element | Type | Function |
|---------|------|----------|
| User initial (no avatar) | Link | Navigate to `/settings` (user settings). No custom avatar display — always shows initial letter. |
| **Sign out** ⏻ | Button (SVG icon) | Sign out via NextAuth, redirect to `/login` |

---

## 5. Project Overview (`/projects/[id]`)

### Top Bar

| Element | Type | Function |
|---------|------|----------|
| **Back** | Button | Navigate to `/` |
| **ProjectIdBadge** | Display + Copy button | Shows project UUID, click to copy to clipboard |
| **ProjectStatusBadge** | Dropdown button (admin only) | Click to open status picker: Not Started / In Progress / Paused / Pending Release / Archived. Selecting a status fires PATCH `/api/projects/[id]` and dispatches `project-status-changed` event. Non-admin: display only. |
| **Project Settings** | Button (admin only) | Navigate to `/projects/[id]/settings` |

### Project Status Dropdown (admin only)

| Element | Type | Function |
|---------|------|----------|
| **Not Started** | Menu item | Set project status, gray |
| **In Progress** | Menu item | Set project status, green |
| **Paused** | Menu item | Set project status, amber |
| **Pending Release** | Menu item | Set project status, cyan |
| **Archived** | Menu item | Set project status, red |

### Navigation Cards

| Element | Type | Function |
|---------|------|----------|
| **Creative Space** card | Link | Navigate to `/projects/[id]/space` |
| **Project Files** card | Link | Navigate to `/projects/[id]/files` |
| **Schedule** card | Link | Navigate to `/projects/[id]/schedule` |
| **Discussion** card | Link | Navigate to `/projects/[id]/discussion` |

### Recent Activity Panel

| Element | Type | Function |
|---------|------|----------|
| **Upcoming Event** row | Link | Navigate to `/projects/[id]/schedule?event=<eventId>` |
| **Recent File** row | Link | Navigate to `/projects/[id]/files?file=<fileId>` |
| **Recent Thread** row | Link | Navigate to `/projects/[id]/discussion?post=<postId>` |
| **Creative Space status** | Display | Shows live participant count ("N online" or "Empty"), polls `/api/projects/[id]/space/status` every 30s |

### Members Panel

| Element | Type | Function |
|---------|------|----------|
| Member avatar | Display (`MemberAvatar`) | Loads from `/api/user/avatar/[userId]`, falls back to initial on error |

---

## 6. Discussion Board (`/projects/[id]/discussion`)

| Element | Type | Function |
|---------|------|----------|
| **Back** | Button (TopBar) | Navigate to `/projects/[id]` |
| **+ New Thread** | Button (primary) | Opens modal with PostForm in "thread" mode |
| **Create Thread** | Button (empty state) | Same as above |
| Thread card (collapsed) | Clickable area | Expands to show full content and replies |
| Thread card (expanded) | Clickable area | Collapses thread |
| **Reply** | Button (ghost) | Shows inline reply form |
| **Cancel Reply** | Button (ghost) | Hides inline reply form |
| **Edit** | Button (ghost, owner only) | Shows inline edit form pre-filled |
| **Cancel Edit** | Button (ghost) | Hides inline edit form |
| **Delete** | Button (ghost, owner/admin) | Browser confirm → DELETE request, removes post + all descendants |
| **AI Format** | Button (ghost, content > 20 chars) | POST `/api/projects/[id]/ai-format`, creates AI-formatted reply. Error with settings link if not configured |
| Reply Edit/Delete | Buttons (ghost, owner/admin) | Same as thread but per reply |

### PostForm (Thread / Reply / Edit)

| Element | Type | Function |
|---------|------|----------|
| Title input | Text field (thread mode only) | Max 200 chars |
| Content textarea | Textarea | Markdown supported, max 10000 chars |
| **Cancel** | Button | Close form |
| **Post Thread** / **Reply** / **Save** | Submit button | Label changes by mode |

---

## 7. Project Files (`/projects/[id]/files`)

| Element | Type | Function |
|---------|------|----------|
| **Back** | TopBar | Navigate to `/projects/[id]` |
| **+ New Folder** | Button | Opens CreateFolderModal |
| **Upload Files** | Button | Opens UploadZone modal |
| Folder tree item | Clickable | Select folder, navigate in. Toggle expand/collapse for folders with children |
| Folder **Rename** (✎) | Button (hover on folder) | Browser prompt → PATCH to rename |
| Folder **Delete** (✕) | Button (hover on folder) | Browser confirm → DELETE folder + contents |
| Breadcrumb segment | Clickable link | Navigate to that folder level |
| Audio file name | Clickable text | Open audio player if `onOpenPlayer` callback provided |

### Audio Player (inline, shown when playing)

| Element | Type | Function |
|---------|------|----------|
| **▶ / ⏸** | Toggle button | Play/pause audio |
| Current time display | Display | Shows current playback position (mm:ss) |
| **Seek slider** | Range slider | Seek to any position in the audio track |
| Duration display | Display | Shows total duration (mm:ss) |
| **Volume toggle** 🔊/🔉/🔇 | Toggle button | Mute/unmute audio (cycles between 0, current, and 1) |
| **Volume slider** | Range slider | Adjust playback volume (0-100%) |

### File Row Actions

| Element | Type | Function |
|---------|------|----------|
| **DL** | Button | Download file (HEAD check → anchor download) |
| **DEL** | Button (danger) | Opens delete confirmation modal |

### Upload Files Modal

| Element | Type | Function |
|---------|------|----------|
| Drop zone | Click/drop area | File browser or drag-and-drop. Validates per-type size limits |
| File queue items | Display with ✕ | Remove individual files from queue |
| **Cancel** | Button | Close modal |
| **Upload (N)** | Button | POST multipart to `/api/projects/[id]/files` |

### Create Folder Modal

| Element | Type | Function |
|---------|------|----------|
| Folder Name input | Text field | Submit on Enter |
| **Cancel** | Button | Close modal |
| **Create** | Button | POST `/api/projects/[id]/folders` |

### Delete File Confirmation

| Element | Type | Function |
|---------|------|----------|
| **Cancel** | Button | Close modal |
| **Delete** | Button (danger) | DELETE `/api/projects/[id]/files/[fileId]` |

---

## 8. Schedule (`/projects/[id]/schedule`)

| Element | Type | Function |
|---------|------|----------|
| **Back** | TopBar | Navigate to `/projects/[id]` |
| **+ Add Event** | Button (purple) | Opens EventForm in create mode |
| **◀** month nav | Button | Previous month |
| **▶** month nav | Button | Next month |
| Day cell | Button | Select date, show events for that day |
| Event **✎** | Button (owner/admin) | Edit event |
| Event **✕** | Button (owner/admin) | Delete event (no confirm) |

### Event Form Modal

| Element | Type | Function |
|---------|------|----------|
| Title input | Text field | Required, max 200 chars |
| Description textarea | Textarea | Optional, max 2000 chars |
| Start datetime | datetime-local input | Required |
| End datetime | datetime-local input | Required, must be after start |
| **Meeting** / **Production** / **Release** / **Other** | Toggle buttons | Select event type |
| **Cancel** | Button | Close modal |
| **Create** / **Save** | Submit button | POST or PATCH |

---

## 9. Project Settings (`/projects/[id]/settings`) (Admin Only)

### General Section

| Element | Type | Function |
|---------|------|----------|
| **Back** | TopBar | Navigate to `/projects/[id]` |
| Project ID display | Code block | Shows project UUID |
| **Copy** | Button | Copy UUID to clipboard, "Copied" feedback for 2s |

### API Access Section

| Element | Type | Function |
|---------|------|----------|
| **Generate API Token** | Button | POST `/api/user/token`, displays generated token |
| Token display + warning | Code block | "Save this token now — it won't be shown again" |
| **Copy Token** | Button | Copy token to clipboard |

### AI Features Section

| Element | Type | Function |
|---------|------|----------|
| API URL input | Text field | OpenAI-compatible endpoint |
| API Key input | Password/text field | With **Show**/**Hide** toggle button inline |
| **Show / Hide** | Inline button | Toggle API key field visibility |
| Model input | Text field | Model name (default: gpt-4o-mini) |
| **Save** | Button (primary) | PUT `/api/projects/[id]/ai-config` |
| **Clear** | Button (ghost, danger hover) | Confirm → DELETE `/api/projects/[id]/ai-config` |

---

## 10. User Settings (`/settings`)

> Note: Avatar upload has been removed. There is no custom avatar functionality.

| Element | Type | Function |
|---------|------|----------|
| **Back** | TopBar | Navigate to `/` |

### Display Name Section

| Element | Type | Function |
|---------|------|----------|
| Name input | Text field | Edit display name |
| **Save Name** | Button | PATCH `/api/user`, reloads page on success |

### Change Password Section

| Element | Type | Function |
|---------|------|----------|
| Current Password input | Password field | Required |
| New Password input | Password field | Min 8 characters |
| **Change Password** | Button | PATCH `/api/user` |

### Danger Zone

| Element | Type | Function |
|---------|------|----------|
| **Delete Account** | Button (danger) | Opens confirmation modal |

#### Delete Account Modal

| Element | Type | Function |
|---------|------|----------|
| **Cancel** | Button | Close modal |
| **Delete Forever** | Button (danger) | DELETE `/api/user`, signs out to `/login` |

---

## 11. Creative Space (`/projects/[id]/space`)

> **⚠️ TO BE REWRITTEN** — The Creative Space page is undergoing major restructuring.
> The interaction inventory below may be outdated. Re-audit this page after the redesign.

### Known current elements (pre-restructure):
- TopBar with back navigation
- LiveKit room connection (token fetch from `/api/projects/[id]/space/token`)
- Control bar (floating): mic toggle, camera toggle, screen share, video watch pause, audio mixer, media settings, leave button
- Device selectors for microphone and camera
- Media quality settings modal (Opus bitrate, send/receive buffer, screen share fps/resolution/bitrate)
- Chat panel with unread badge, message send
- Participant grid (video tiles) and participant list (with status indicators)
- VST/DAW audio bridge panel (connection status, reconnect, broadcast toggle, volume meters)
- Audio mixer panel (per-channel volume sliders for local mic, DAW, remote participants)
- Connection error screen with Retry button

---

## Summary: Every Action By Type

### Navigation
- Login ↔ Register (links)
- Dashboard → Project (card click, sidebar project link)
- Project → Sub-pages (4 nav cards + activity links with query params)
- Sub-page → Back to project (TopBar back)
- Any → User Settings (sidebar user initial)
- Any → Dashboard (logo/Projects link)
- Any → Login (sign out)

### Create
- Project (name + description)
- Discussion thread (title + Markdown content)
- Reply to thread/post (Markdown content)
- Folder (name in current directory)
- Upload files (multi-file, drag-and-drop)
- Schedule event (title + description + datetime range + type)
- API token (generate once)

### Edit
- Own discussion post/reply (content)
- Schedule event (all fields)
- Rename folder (prompt)
- Display name
- Password
- AI config (API URL, key, model)
- Project status (5 options, admin only)

### Delete
- Own discussion post/reply (with confirm, cascades to descendants)
- Any post/reply (admin)
- File (confirm modal)
- Folder + contents (confirm)
- Schedule event
- AI configuration (confirm)
- Own account (double confirm → sign out)

### Notifications (cross-cutting)
- Bell icon with unread badge (polls every 30s)
- Dropdown list with type icons and timestamps
- Per-item mark-read or navigate
- Mark all read
- Per-project unread badges on sidebar and project cards
- Clear project unread on view

### Project Status (cross-cutting)
- 5 statuses: Not Started, In Progress, Paused, Pending Release, Archived
- Status badge on project cards and sidebar (colored dot)
- Clickable dropdown in project overview (admin only)
- Archived/paused projects collapsed into "Inactive" section on dashboard

### Toggle / State Controls
- Sidebar collapse/expand
- Folder tree expand/collapse
- Thread expand/collapse
- Inactive projects section expand/collapse
- Notification dropdown open/close
- API key show/hide
- Audio playback (play/pause, seek, volume)
