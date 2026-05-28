# SonicBridge

Real-time music production collaboration platform. Stream DAW audio through a VST3 plugin into browser-based Creative Spaces powered by LiveKit — remote collaborators hear your mix, see your screen, and chat in real time.

## Core Features

### User System
- **Registration & Login** — credential-based auth with NextAuth v5
- **User Settings** — display name, password change, account deletion

### Project Management
- **Create Projects** — with name and description
- **Join Projects** — via UUID or custom ID shared by collaborators
- **Role-Based Access** — admin and member roles per project
- **Project Status** — 5 statuses: Not Started, In Progress, Paused, Pending Release, Archived. Admin can change in project overview via dropdown badge.
- **Archived/Paused** — inactive projects collapsed into expandable section on dashboard

### Notifications
- **Per-Project Unread Counts** — sidebar and project cards show red badges with thread, file, and event counts
- **Per-Tab Badges** — Discussion, Files, Schedule nav cards each show their own unread count
- **Auto-Dismiss** — entering a project or tab clears corresponding badges (persisted across sessions via localStorage)

### Discussion Board
- **Threaded Discussions** — create threads, reply inline, edit/delete posts
- **Markdown Support** — rich text formatting with full Markdown rendering
- **AI Formatting** — per-project configurable AI API (OpenAI-compatible) to format discussion posts
- **Admin Controls** — admins can delete any post or reply

### File Management
- **Upload Files** — drag-and-drop or browse, multi-file upload with size limits per type (Audio 500MB, Archives 5GB, Video 500MB, Other 100MB)
- **Drag-and-drop file moves** — drag a file onto a folder in the tree or breadcrumb to move it; optimistic UI with server PATCH
- **Folder Organization** — create, rename, delete folders with nested hierarchy
- **Breadcrumb Navigation** — traverse folder structure
- **Inline Audio Player** — play/pause, seek bar with time display, volume slider with mute toggle
- **Download & Delete** — download any file, delete with confirmation
- **CLI access** — manage files, folders, calendar, and discussion from a terminal or AI agent via the [`sonicbridge` CLI](./docs/cli/README.md)

### Schedule / Calendar
- **Month View Calendar** — navigate months, click days to filter events
- **Event Types** — Meeting (cyan), Production (green), Release (purple), Other (gray)
- **Create / Edit / Delete Events** — title, description, start/end datetime, type selectors

### Creative Space (Real-Time Collaboration)
- **LiveKit Room** — per-project persistent room with token-based access
- **Spotlight View** — double-click any participant video to pin it large; auto-spotlights screen shares. Thumbnail strip to switch focus.
- **Screen Sharing** — configurable resolution (720p/1080p/Original) and frame rate (15/30/60 fps)
- **Voice Chat** — microphone toggle with noise reduction (Off/Suppression/Voice Isolation), per-device selection
- **Camera** — video toggle with configurable resolution, frame rate, and bitrate
- **Text Chat** — real-time messaging with unread count badge
- **Participant List** — online participants with mic/camera/screen/DAW status indicators and real-time bitrate/resolution stats
- **Bandwidth Saver** — pause/resume video watching to save bandwidth while keeping audio
- **Media Quality Settings** — Opus audio bitrate (192-640 kbps), send/receive buffer, noise reduction mode, camera/screen share quality presets
- **Audio Mixer** — per-channel volume sliders for local mic, DAW input, remote participants; live level meters

### DAW Audio Bridge (VST)
- **VST3 Plugin** — load in any DAW, streams audio to browser via WebSocket
- **Real-Time Metering** — stereo level meters with peak indication in the web UI
- **Broadcast Toggle** — enable/disable publishing DAW audio to the LiveKit room
- **Configurable Port** — enter the port shown in your DAW plugin window
- **WebSocket Protocol** — JSON-based communication with handshake, keep-alive, error handling

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Runtime | React 19, TypeScript |
| Styling | Tailwind CSS 4 |
| Auth | NextAuth v5 (credentials) |
| Database | PostgreSQL (Neon) + Drizzle ORM |
| Storage | Vercel Blob |
| Real-Time | LiveKit (WebRTC) |
| Audio | Opus codec, WebCodecs AudioDecoder, Web Audio API |
| State | Zustand |
| Validation | Zod |
| VST Plugin | C++ / JUCE 8 |

## Project Structure

```
sonicbridge/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Login & Register pages
│   │   ├── login/
│   │   └── register/
│   └── (dashboard)/              # Authenticated pages
│       ├── page.tsx              # Project list (dashboard)
│       ├── settings/             # User settings
│       └── projects/[id]/
│           ├── page.tsx          # Project overview with activity & members
│           ├── discussion/       # Threaded discussion board
│           ├── files/            # File browser with folder tree
│           ├── schedule/         # Calendar & events
│           ├── settings/         # Project admin settings (AI, API tokens)
│           └── space/            # Creative Space (LiveKit room)
├── components/
│   ├── ui/                       # Design system (Button, Input, Modal, Card, GlassPanel)
│   ├── discussion/               # DiscussionBoard, ThreadCard, PostForm
│   ├── files/                    # FileBrowser, UploadZone, FolderTree, FileList
│   ├── schedule/                 # CalendarGrid, EventForm, EventItem
│   ├── space/                    # SpotlightView, ControlBar, AudioMixer, ChatPanel, etc.
│   └── settings/                 # AiConfigForm
├── lib/
│   ├── auth.ts                   # NextAuth configuration
│   ├── db/                       # Drizzle schema & database client
│   ├── livekit.ts                # LiveKit token generation
│   ├── vst-bridge.ts             # WebSocket client for VST plugin
│   ├── audio-pipeline.ts         # Audio decoding and processing
│   ├── mic-pipeline.ts           # Microphone audio processing pipeline
│   ├── storage.ts                # Vercel Blob file size limits
│   ├── encryption.ts             # API key encryption
│   ├── image-utils.ts            # Image validation & resizing
│   └── store/                    # Zustand stores (sidebar, space, vst, media-settings, notification)
├── vst-plugin/                   # C++ VST3 plugin (JUCE 8)
│   ├── CMakeLists.txt
│   └── *.cpp / *.h
├── scripts/
│   └── mock-vst-server.ts        # Mock WebSocket server for local dev
├── docs/
│   └── frontend-interactions.md  # Complete per-page interaction reference
└── public/
    └── audio-worklet.js          # Audio decoding worklet
```

## Quick Start

```bash
cp .env.example .env.local   # fill in DATABASE_URL, AUTH_SECRET, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL
npm install
npm run mock-vst             # terminal 1: mock VST WebSocket server (optional)
npm run dev                  # terminal 2: Next.js at http://localhost:3000
```

### Development Commands

```bash
npm run dev          # Start Next.js dev server
npm run mock-vst     # Start mock VST WebSocket server (port 9420)
npm run test         # Run Vitest test suite
npm run test:watch   # Watch mode
npm run typecheck    # TypeScript type checking
npm run lint         # ESLint
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string (Neon) |
| `AUTH_SECRET` | Yes | — | NextAuth.js session signing secret |
| `LIVEKIT_API_KEY` | Yes | — | LiveKit Server API key |
| `LIVEKIT_API_SECRET` | Yes | — | LiveKit Server API secret |
| `LIVEKIT_URL` | Yes | `ws://localhost:7880` | LiveKit server WebSocket URL |
| `VST_WS_PORT` | No | `9420` | VST plugin WebSocket server port |

---

## VST3 Plugin

The VST3 plugin captures audio from any DAW track, encodes it with Opus, and streams it to the browser via WebSocket. The browser then publishes the audio into the LiveKit room so remote collaborators can hear the DAW output in real time.

### Building from Source

**Prerequisites:** CMake ≥ 3.22, Visual Studio 2022 Build Tools, vcpkg, JUCE 8.0+

```powershell
# Install vcpkg dependencies
cd C:\dev\vcpkg
.\vcpkg install opus:x64-windows ixwebsocket:x64-windows openssl:x64-windows

# Configure and build
cd vst-plugin
mkdir build; cd build
cmake .. -G "Visual Studio 17 2022" -A x64 `
  -DCMAKE_TOOLCHAIN_FILE="C:/dev/vcpkg/scripts/buildsystems/vcpkg.cmake" `
  -DJUCE_PATH="C:/path/to/JUCE"
cmake --build . --config Release
```

The VST3 bundle is created at `build\SonicBridgeVST_artefacts\Release\VST3\SonicBridge VST.vst3\`.

### Installing in a DAW

Copy the entire bundle to the system VST3 directory:

| Platform | Path |
|----------|------|
| Windows | `C:\Program Files\Common Files\VST3\` |
| macOS | `~/Library/Audio/Plug-Ins/VST3/` or `/Library/Audio/Plug-Ins/VST3/` |

Launch your DAW, re-scan plugins. The plugin appears under **Fx | Analyzer**.

### How It Works

1. Load the plugin on any DAW track (master bus recommended).
2. The plugin starts a WebSocket server on `ws://127.0.0.1:9420`.
3. Open the SonicBridge web app, navigate to a Creative Space room.
4. The browser connects to the plugin's WebSocket server.
5. Audio flows: **DAW → Plugin (Opus encode) → WebSocket → Browser (AudioDecoder) → LiveKit Room**.

### Plugin Parameters

| Parameter | Range | Default | Description |
|-----------|-------|---------|-------------|
| Opus Bitrate | 16–512 kbps | 128 | Audio encoding quality/bandwidth |

The bitrate can be adjusted from the DAW's plugin parameter panel or remotely from the browser.

### WebSocket Protocol

| Message Type | Direction | Description |
|-------------|-----------|-------------|
| `handshake` | Browser → Plugin | Authenticate with project/user ID |
| `status` | Plugin → Browser | Connection state, plugin name/version |
| `audio` | Plugin → Browser | Opus-encoded audio packet (Base64) |
| `meter` | Plugin → Browser | Volume meter levels (L/R/peak in dBFS) |
| `settings` | Plugin → Browser | Current plugin settings |
| `set_settings` | Browser → Plugin | Change settings (e.g., Opus bitrate) |
| `get_settings` | Browser → Plugin | Request current settings |
| `ping` / `pong` | Bidirectional | Keep-alive |
| `error` | Plugin → Browser | Error message |
| `disconnect` | Plugin → Browser | Server shutting down |

### Testing Without a DAW

Use the mock server for development:

```bash
npm run mock-vst
```

This starts a WebSocket server on port 9420 that simulates the VST3 plugin with fake status messages, meter levels, and settings.
