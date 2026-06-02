# SonicBridge — Frontend Interaction Reference

> Complete inventory of every interactive element across all pages.
> Use this as a checklist when refactoring to ensure no functionality is lost.
>
> **Last updated:** 2026-05-25 (branch `dev`)

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
| **AI Format** | Button (ghost) | Only on posts with content > 20 chars AND `!isAiGenerated`. POST `/api/projects/[id]/ai-format`, creates AI-formatted reply. Error with settings link if not configured |
| Reply Edit/Delete | Buttons (ghost, owner/admin) | Same as thread but per reply. Reply **Reply** button also available on all replies |
| **AI** badge | Display (inline, on AI-generated posts) | Orange "AI" badge next to "(edited)" marker when `isAiGenerated` is true |

### PostForm (Thread / Reply / Edit)

Uses `@uiw/react-md-editor` with dark theme and split live preview (`preview="live"`).

| Element | Type | Function |
|---------|------|----------|
| Title input | Text field (thread mode only) | Max 200 chars |
| **+ Cite File** | Toggle button | Shows file picker dropdown to insert Markdown citation links. Only when `availableFiles` present |
| File picker item | Button | Click to insert `[filename](/projects/[id]/files?file=id)` citation at cursor |
| MDEditor | Markdown editor | Split view: left=edit, right=live rendered preview. Max 10000 chars. Height 250px (thread) / 200px (reply/edit) |
| **Draft restored** | Display | Appears when unsaved draft restored from localStorage (draft auto-saves every 300ms) |
| **Cancel** | Button | Close form, discard draft |
| **Post Thread** / **Reply** / **Save** | Submit button | Label changes by mode. Clears draft on success |

---

## 7. Project Files (`/projects/[id]/files`)

### File Browser Layout

```
┌──────────────┬──────────────────────────────────────┐
│  Folder Tree  │  Breadcrumb Nav (drop targets)       │
│  (drop zones) │  ──────────────────────────────────  │
│               │  File List (draggable rows)          │
│  [All Files]  │  [Upload] [Rename inline] [DL] [DEL] │
│  [Root]       │                                      │
│  [Folders...] │  Audio player bar (on play)          │
└──────────────┴──────────────────────────────────────┘
```

| Element | Type | Function |
|---------|------|----------|
| **Back** | TopBar | Navigate to `/projects/[id]` |
| **+ New Folder** | Button | Opens CreateFolderModal |
| **Upload Files** | Button | Opens UploadZone modal |

### Folder Tree

| Element | Type | Function |
|---------|------|----------|
| **All Files** | Virtual view button | Shows ALL files across every folder (sends `?all=1`). Breadcrumb shows "* All Files" |
| **Root** | Button | Show top-level files only (no folder). Always expanded |
| Folder item | Button | Select folder, navigate in. Toggle expand/collapse for folders with children |
| Folder **Rename** (✎) | Button (hover) | Browser prompt → PATCH `/api/projects/[id]/folders/[folderId]` |
| Folder **Delete** (✕) | Button (hover) | Browser confirm → DELETE. Refuses non-empty folders with 409 |
| **Drop zone** (folder) | Drop target | Drag a file row onto a folder to move it there. Green ring highlight on hover |

### Breadcrumb Nav (drop targets)

| Element | Type | Function |
|---------|------|----------|
| Breadcrumb segment | Clickable link (non-last) / Display (last) | Navigate to that folder level |
| **Drop zone** (each segment) | Drop target | Drag a file onto any breadcrumb segment to move it to that folder. Green ring + glow on hover |

### File Row

| Element | Type | Function |
|---------|------|----------|
| File row | **Draggable** (`application/x-sb-file` MIME) | Drag to folder tree or breadcrumb to move file. PATCH `/api/projects/[id]/files/[fileId]` with `{ folderId }`. Disabled when player or rename is active |
| Audio file icon | Display | SPEAKER tag. Click name to open `AudioPlayerModal` |
| File name | Display (clickable for audio) | Opens `AudioPlayerModal` for audio files |

### Inline Rename

| Element | Type | Function |
|---------|------|----------|
| Rename input | Text field | Editable **basename only** (extension shown as non-editable gray suffix label). Submit on Enter, cancel on Escape/blur |
| Extension label | Display (inline suffix) | Gray, non-editable (e.g. `.wav`). Server enforces extension lock — returns 422 if extension is changed |

### Audio Player (inline, shown when playing)

| Element | Type | Function |
|---------|------|----------|
| **▶ / ⏸** | Toggle button | Play/pause audio |
| Current time display | Display | mm:ss format |
| **Seek slider** | Range slider | Seek to any position |
| Duration display | Display | Total duration (mm:ss) |
| **Volume toggle** 🔊/🔉/🔇 | Toggle button | Mute/unmute |
| **Volume slider** | Range slider | 0-100% |

### File Row Actions

| Element | Type | Function |
|---------|------|----------|
| **DL** | Button | Download file (HEAD check → anchor download) |
| **DEL** | Button (danger) | Opens password verification prompt |

### Delete File — Password Challenge

| Element | Type | Function |
|---------|------|----------|
| Password prompt | Browser `prompt()` | Enter password to confirm deletion |
| Password verification | POST `/api/user/verify-password` | Returns one-shot challenge token |
| DELETE with challenge | DELETE `/api/projects/[id]/files/[fileId]` | Passes challenge token for authorization |

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

### Edit Project Section

| Element | Type | Function |
|---------|------|----------|
| Project Name input | Text field | Edit project name |
| Description input | Text field | Edit project description |
| **Save** | Button | PATCH `/api/projects/[id]` |

### CLI Access Section

| Element | Type | Function |
|---------|------|----------|
| **Generate CLI Token** | Button | POST `/api/user/token`, displays generated token for `sonicbridge` CLI use |
| Token display + warning | Code block | "Save this token now — it won't be shown again" |
| **Copy Token** | Button | Copy token to clipboard |
| CLI docs link | Reference | Points to `docs/cli/install-for-agents.md` for setup instructions |

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

### Page Layout

```
┌──────────────┬──────────────────────────────┬──────────────┐
│  DAW 面板    │       主区域 (Spotlight)       │ 成员列表     │
│  (w-72)      │   - 视频网格 / 聚光灯模式      │              │
│              │   - RoomAudioRenderer         │  [聊天按钮]  │
├──────────────┴──────────────────────────────┴──────────────┤
│              浮动控制栏 (底部居中)                            │
└────────────────────────────────────────────────────────────┘
```

Page has 3 render states: Loading (spinner), Error (retry), Connected (full UI).

### Connection Error Screen

| Element | Type | Function |
|---------|------|----------|
| ⚠ icon + "Connection Failed" | Display | |
| Error message | Display | |
| **Retry** | Button | Abort current request, re-fetch LiveKit token |

### DAW Audio Bridge Panel (left sidebar, fixed w-72)

**Disconnected / Error state:**

| Element | Type | Function |
|---------|------|----------|
| Status LED | Display | Green=Connected, Yellow=Connecting, Gray=Disconnected, Red=Error |
| Plugin name + version | Display | |
| Error message | Display (red bg) | `lastError` text |
| **Reconnect** | Button (full width) | Retry VST WebSocket connection |
| Port input | Number input | WebSocket port number |
| **Connect** | Button | Save port to store, trigger reconnect |

**Connected state:**

| Element | Type | Function |
|---------|------|----------|
| **Level** meter (`VstVolumeMeter`) | Display | Real-time L/R/Peak levels (dBFS) |
| **Audio** info | Display | Sample Rate (kHz), Channels |
| **Broadcast to Room** | Checkbox | Toggle publishing DAW audio to LiveKit room |
| Published status | Display | Green=Published, Yellow=Publishing |

### Main Area — SpotlightView

Replaces old `ParticipantGrid`. Two display modes: Grid and Spotlight.

**Empty state (no tracks):**

| Element | Type | Function |
|---------|------|----------|
| Bandwidth saving prompt | Display | When `videoWatchEnabled=false`: 🔋 + "Video paused" |
| Waiting prompt | Display | Normal: ◈ + "Waiting for collaborators..." |

**Grid mode (≤2 tracks or spotlight not active):**

| Element | Type | Function |
|---------|------|----------|
| Track tile | `ParticipantTile` | Participant video / screen share |
| **Double-click tile** | Gesture | Enter spotlight mode for that track (≥3 tracks only) |

**Spotlight mode (≥3 tracks, spotlight active):**

| Element | Type | Function |
|---------|------|----------|
| Main spotlight tile | `ParticipantTile` (large) | Focused track |
| Identity label | Display (bottom-left overlay) | Participant name (+ "— Screen" if screen share) |
| **Exit Spotlight** | Button (top-right overlay) | Return to grid mode |
| Thumbnail strip | Clickable thumbnails | Click to switch spotlight focus |

**Auto behavior:** Screen share starts → auto-spotlight that screen share. Screen share ends → auto-exit spotlight. Spotlight track disappears (participant leaves) → auto-exit.

### Participant List (right sidebar, upper)

| Element | Type | Function |
|---------|------|----------|
| **People** header + count | Display | |
| Participant avatar | Display | Initial letter, green glow pulse when speaking |
| Participant name + "You" tag | Display | Purple "You" badge for local user |
| Status dots (4) | Display | Mic: Green=On/Red=Off, Cam: Green=On/Red=Off, Screen: Blue=On/Gray=Off, DAW: Purple=Active/Gray=Off (self only) |
| Stats row | Display | Audio bitrate, video resolution+fps+bitrate, screen share resolution+fps+bitrate |
| Footer legend | Display | Mic / Cam / Screen / DAW color key |

### Chat Panel (right sidebar, lower)

| Element | Type | Function |
|---------|------|----------|
| **💬 Chat button** | Toggle | Open/close chat panel. Blue unread count badge (99+) when closed and new messages arrive |
| **✕** | Button | Close chat panel |
| Message list | Scrollable (auto-scroll) | Own messages blue bg right-aligned, others gray bg left-aligned |
| Sender + time | Display | Per message |
| Message input | Text input | |
| **Send** | Submit | Send LiveKit chat message. Disabled when empty or sending (shows "...") |

### Floating Control Bar (bottom center, fixed)

| # | Icon | Type | Function |
|---|------|------|----------|
| 1 | 🎤/🔇 | Mic toggle | On: start mic pipeline (echoCancellation + noiseSuppression/voiceIsolation) → publish track. Off: stop pipeline → unpublish. Green=On, Red=Off |
| 2 | ▼ | Device selector | Open `DeviceSelector` popup (audioinput devices) |
| 3 | 📹/📷 | Camera toggle | `setCameraEnabled(!isCameraEnabled)`. Green=On, Red=Off |
| 4 | ▼ | Device selector | Open `DeviceSelector` popup (videoinput devices) |
| 5 | 🖥 | Screen share toggle | Uses media-settings store config (resolution/fps). Blue=Sharing, Gray=Off |
| 6 | 👁/👁‍🗨 | Video watch toggle | Pause/resume video subscription to save bandwidth. Gray=On, Amber=Bandwidth saving |
| 7 | 🎚 | Mixer toggle | Open/close `AudioMixer` panel. Blue=Open, Gray=Closed |
| 8 | ⚙ | Media settings toggle | Open/close `MediaSettingsPanel` modal. Blue=Open, Gray=Closed |
| — | | Separator | |
| 9 | Green/Red dot | Connection status | "Live" (green pulse) / "Off" (red) |
| 10 | **Leave** | Button | `router.push(/projects/[id])` |

### DeviceSelector Popup

| Element | Type | Function |
|---------|------|----------|
| Header | Display | "Input Device" / "Camera" |
| "Loading devices..." | Display | Enumerating |
| Device list item | Button | Switch active device via `room.switchActiveDevice()` |
| **Cancel** | Button | Close popup |

### MediaSettingsPanel Modal

**Microphone section:**

| Element | Type | Range/Options |
|---------|------|---------------|
| **Opus Bitrate** | Range slider | 192–640 kbps, step 32 kbps |
| **Send Buffer** | Range slider | 8–2048ms, step 8ms |
| **Receive Buffer** | Range slider | 8–2048ms, step 8ms |
| **Noise Reduction** | Toggle buttons (3) | Off (white) / Suppression (green) / Voice Iso (Chrome) (purple). Switching auto-restarts mic pipeline |

**Camera section:**

| Element | Type | Options |
|---------|------|---------|
| **Frame Rate** | Toggle buttons (3) | 15 / 30 / 60 fps |
| **Resolution** | Toggle buttons (2) | 720p / 1080p |
| **Bitrate** | Range slider | 0.5–5 Mbps, step 250 kbps |

**Screen Share section:**

| Element | Type | Options |
|---------|------|---------|
| **Frame Rate** | Toggle buttons (3) | 15 / 30 / 60 fps |
| **Resolution** | Toggle buttons (3) | 720p / 1080p / Original |
| **Bitrate** | Range slider | 0.5–5 Mbps, step 250 kbps |

### AudioMixer Panel (floating, top-center)

**Inputs section:**

| Element | Type | Function |
|---------|------|----------|
| Header **✕** | Button | Close panel |
| **Local Microphone** level bar | Real-time level meter | Color by audio level: blue(quiet)→green→yellow→red(loud). Driven by `micMeterLevel` from mic pipeline |
| **Local Microphone** Gain | Range slider | 0–200%, step 1% |
| **DAW Audio (VST)** meter | `VstVolumeMeter` | Real-time L/R/Peak levels. Only shown when connected + published |
| **DAW Audio (VST)** Volume | Range slider | 0–200%, step 1% |
| **DAW Bitrate** | Range slider | 192–510 kbps, step 2 kbps |
| **DAW Send Buffer** | Range slider | 8–2048ms, step 8ms |

**Outputs section:**

| Element | Type | Function |
|---------|------|----------|
| **Receive Buffer** | Range slider | 8–2048ms, step 8ms. Affects all received audio |
| "No other participants" | Display | When no remote audio |
| Remote participant name + % | Display | |
| Remote participant level bar | Real-time level meter | Color by audio level: blue→green→yellow→red. Driven by `useTrackAudioLevel` per remote audio track |
| Remote participant Volume | Range slider (per person) | 0–200%, step 1% |

---

## 12. Notification System (cross-cutting)

> No notification bell or dropdown. Uses sidebar polling + per-project/per-tab badges.

### Architecture

```
GET  /api/notifications/unread-counts  →  store.unreadByProject
POST /api/notifications/view           →  update lastViewedAt (server)
```

### UnreadEntry Structure
```
{ total: number; threads: number; files: number; events: number }
```
- `total` = threads + files + events (used by sidebar + project cards)
- Sub-counts used by individual tab badges

### Dismissed Mechanism (localStorage)
- Key: `"notif-dismissed"`, persists `{ [projectId]: UnreadEntry }`
- Server count minus dismissed = displayed count (clamped to ≥0)
- Survives page refresh and browser restart

### Notification Types

| type | Source | Persistent? |
|------|--------|-------------|
| `new_post` | New thread in discussionPosts | Yes (notifications table) |
| `new_reply` | New reply in discussionPosts | No (source-table query) |
| `reply_to_user` | Someone replied to your post | Yes (notifications table) |
| `new_event` | New schedule event | No (source-table query) |
| `new_file` | New file upload | No (source-table query) |

### Component Positions

**Sidebar — project item badge:**

| Element | Type | Function |
|---------|------|----------|
| Red badge on project link | Display | Shows `unreadByProject[projectId].total`. Polls every 30s via `fetchUnreadCounts()` |

**Dashboard — ProjectCardWrapper:**

| Element | Type | Function |
|---------|------|----------|
| Red badge on project card | Display | Shows `unreadByProject[projectId].total` |

**Project Overview — NavCardLink (4 nav cards):**

| Element | Type | Function |
|---------|------|----------|
| Discussion card badge | Display | Shows `unreadByProject[projectId].threads`. Click clears via `recordTabView(projectId, "discussion")` |
| Files card badge | Display | Shows `unreadByProject[projectId].files`. Click clears via `recordTabView(projectId, "files")` |
| Schedule card badge | Display | Shows `unreadByProject[projectId].events`. Click clears via `recordTabView(projectId, "schedule")` |
| Creative Space card | No badge | |

### User Interactions

| # | Interaction | Trigger | Result |
|---|-------------|---------|--------|
| 1 | Enter project | Sidebar project / Dashboard card click | `recordProjectView`: dismiss ALL notifications for that project |
| 2 | Enter Discussion tab | NavCardLink (Discussion) click | `recordTabView`: dismiss only threads badge |
| 3 | Enter Files tab | NavCardLink (Files) click | `recordTabView`: dismiss only files badge |
| 4 | Enter Schedule tab | NavCardLink (Schedule) click | `recordTabView`: dismiss only events badge |
| 5 | Poll refresh | Sidebar 30s interval | `fetchUnreadCounts`: refresh all unread counts, subtract dismissed |

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
- Sidebar 30s polling for unread counts (no bell/dropdown)
- Per-project unread badges on sidebar and dashboard cards (total)
- Per-tab badges on nav cards (threads/files/events) via NavCardLink
- localStorage dismissed mechanism persists across sessions
- `recordProjectView`: clear all notifications for a project on enter
- `recordTabView`: clear only specific tab notifications on tab enter

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
- API key show/hide
- Audio playback (play/pause, seek, volume)
