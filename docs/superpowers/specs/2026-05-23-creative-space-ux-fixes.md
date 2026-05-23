# Creative Space UX Fixes — Design Doc

**Date:** 2026-05-23
**Branch:** TBD
**Status:** Design approved, pending implementation plan

## Overview

Three fixes for the Creative Space real-time collaboration feature:

1. **Microphone not opening** — Browser `getUserMedia` succeeds but LiveKit mic enable fails silently
2. **Spotlight view** — Add ability to enlarge one participant's video/screen share when many people are in the room
3. **Realtime quality stats** — Display per-participant upload quality metrics; verify and fix that settings actually affect encoding

---

## Part 1: Microphone Fix

### Root Cause

`LiveKitRoom` is configured with `audio={false}`, so LiveKit does not pre-build audio infrastructure. When `handleToggleMic` calls `setMicrophoneEnabled(true, processorOpts)`, `getUserMedia` succeeds (antivirus detects mic access), but the `MicProcessor.init()` step — which requires LiveKit's `AudioContext` — can fail. The empty `catch {}` swallows the error, making diagnosis impossible.

### Fix

1. **Error logging:** Replace `catch {}` with `catch (e) { console.error("Mic toggle failed:", e); }` in `handleToggleMic`
2. **Permission pre-warm:** Before calling `setMicrophoneEnabled(true)`, do a quick `getUserMedia({audio:true})` → stop tracks immediately. This ensures browser permission is granted before LiveKit tries to set up the processor pipeline
3. **MicProcessor resilience:** Wrap `init()` in try/catch; on failure, fall back to a pass-through mode (no gain/analyser nodes, but still returns a valid track) so mic works even if DSP fails

### Files Changed

- `components/space/ControlBar.tsx` — `handleToggleMic`
- `lib/mic-processor.ts` — `init()`, add fallback mode

---

## Part 2: Spotlight View (Discord-Style)

### Design

A two-tier layout: one large main area + a horizontal thumbnail strip below.

```
+--------------------------------------------------+
| Main Spotlight Area (~80% height)                 |
| +----------------------------------------------+ |
| |  ParticipantTile (large)                      | |
| |  + name + resolution overlay                  | |
| |  [Exit Spotlight] button (top-right)          | |
| +----------------------------------------------+ |
+--------------------------------------------------+
| Thumbnail Strip (~72px height, horizontal scroll) |
| +------+ +------+ +--------+ +------+            |
| | User1| | User2| | User3* | | User4|            |
| +------+ +------+ +--------+ +------+            |
|                    * highlighted border           |
+--------------------------------------------------+
```

### Behavior

- **Enter spotlight:** Double-click any participant tile → that track becomes the large main view
- **Switch spotlight:** Click a different thumbnail in the strip → swaps the main view
- **Exit spotlight:** Click [Exit Spotlight] button, or double-click the main view → returns to standard grid
- **Auto-exit:** When the spotlighted participant disconnects → falls back to grid
- **Screen share priority:** If a participant starts screen sharing, auto-spotlight that stream
- **Thumbnail strip:** Horizontally scrollable when there are more thumbnails than fit
- **Single participant:** When only 1-2 people are in the room, grid mode is used by default (no spotlight needed)

### Component Structure

```
SpotlightView.tsx  ← NEW: main container, manages activeTrackId state
  ├── SpotlightMain.tsx  ← NEW: renders the large focused tile
  ├── SpotlightStrip.tsx  ← NEW: renders horizontal thumbnail scroll
  └── ParticipantGrid.tsx  ← EXISTING: reused for grid fallback mode
```

### Files Changed

- New: `components/space/SpotlightView.tsx` — spotlight layout + state management
- Modify: `components/space/CreativeSpaceRoom.tsx` — replace `ParticipantGrid` with `SpotlightView`

---

## Part 3: Realtime Stats & Settings Verification

### 3a. Stats Display

Add per-participant upload quality stats in the sidebar `ParticipantList`.

```
Each ParticipantRow, when active:
┌─────────────────────────────────────────┐
│ ● Alice                    [🎤] [📹] [🖥]│
│   🎤 256kbps  📹 1080p30  🖥 2.5Mbps    │  ← NEW stats row
└─────────────────────────────────────────┘
```

**Data source:** Poll `room.connectionState` and track-level stats via LiveKit's `Room.getStats()` or per-track `Track.getStats()`. Polled every 2 seconds via a custom hook `useTrackStats(participantIdentity)`.

**Display rules:**
- Audio bitrate: only shown when mic is on
- Video resolution + FPS: only shown when camera is on
- Screen share bitrate: only shown when screen sharing (replaces video stat when both are on and screen share is the dominant stream)
- Use small monospace badges with the existing cyan/green/amber color scheme

### 3b. Settings Verification & Fix

**Bug found:** The `audioQuality.bitrate` value stored in Zustand is NEVER passed to LiveKit's audio encoder. Users can move the slider in MediaSettingsPanel and AudioMixer, but it has zero effect on actual encoding.

**Fixes:**

| Setting | Status | Action |
|---------|--------|--------|
| Audio bitrate | Dead — value stored but unused | Pass via `AudioCaptureOptions` to `setMicrophoneEnabled` |
| Audio send buffer | Dead — value stored but unused | Pass via `AudioCaptureOptions` to `setMicrophoneEnabled` |
| Audio receive buffer | Used only in VST pipeline | No change — VST bridge applies it correctly |
| Screen share FPS | Working | No change |
| Screen share resolution | Working | No change |
| Screen share bitrate | Working | No change |
| Camera video quality | Missing — no settings exist | Add basic camera settings: resolution + bitrate (future, out of scope for this fix) |

**Key code change in `handleToggleMic`:**

```ts
const aq = useMediaSettingsStore.getState().audioQuality;
await localParticipant.setMicrophoneEnabled(true, {
  ...getMicProcessor().getCaptureOptions(),
  audioEncoding: {
    maxBitrate: aq.bitrate,
  },
});
```

### Files Changed

- `components/space/ParticipantList.tsx` — add stats row to `ParticipantRow`
- `components/space/ControlBar.tsx` — `handleToggleMic` + `handleToggleScreenShare` (apply settings)
- New: `lib/hooks/useTrackStats.ts` — stats polling hook
- `lib/store/media-settings.ts` — no changes needed (already has correct defaults)

---

## Error Handling

- Mic toggle failure: console.error + optional user-facing toast (future)
- Stats polling failure: silent fallback to empty stats, no crash
- Spotlight on disconnected participant: auto-exit to grid

## Testing

- [ ] Mic: toggle on/off in a room with another user, verify audio is heard
- [ ] Mic: verify console errors appear if mic fails
- [ ] Spotlight: 4+ participants, double-click to enter, click thumbnails to switch, exit
- [ ] Spotlight: screen share auto-spotlights
- [ ] Stats: verify bitrate/resolution/fps appear in sidebar and update every ~2s
- [ ] Settings: change audio bitrate in settings, verify actual encoding changes (check in about:webrtc or LiveKit dashboard)
- [ ] TypeScript: `npx tsc --noEmit` passes
