# Creative Space UX Fixes v3 — Design Spec

**Date:** 2026-05-23
**Status:** Design approved

## Part 1: MediaSettings Panel Redesign

### Current Problems
- Camera quality settings don't exist (no way to configure resolution/fps/bitrate for webcam)
- Screen share settings are the only video configuration
- Noise suppression / voice isolation toggles are buried in AudioMixer, not in MediaSettings
- `noiseSuppression`/`voiceIsolation` stored as separate booleans — should be a single mode

### Design

Three independent sections in the modal:

**Microphone:**
- Opus Bitrate slider (192-640 kbps)
- Send Buffer slider
- Receive Buffer slider
- Noise Reduction: 3-way exclusive toggle — `Off` / `Suppression` / `Voice Isolation (Chrome)`

**Camera** (NEW separate section):
- Frame Rate: 15/30/60 fps buttons
- Resolution: 720p / 1080p buttons (no "Original" — doesn't make sense for webcam)
- Bitrate slider (0.5-5 Mbps)

**Screen Share** (separate from Camera):
- Frame Rate: 15/30/60 fps buttons
- Resolution: 720p / 1080p / Original buttons
- Bitrate slider (0.5-5 Mbps)

### Store Changes (`lib/store/media-settings.ts`)

```ts
// Replace noiseSuppression/voiceIsolation booleans with:
type NoiseMode = "off" | "suppression" | "voiceIsolation";

interface AudioQualitySettings {
  bitrate: number;
  sendBufferMs: number;
  receiveBufferMs: number;
  noiseMode: NoiseMode;  // default: "suppression"
}

// NEW
interface CameraSettings {
  frameRate: 15 | 30 | 60;
  resolution: "720p" | "1080p";
  bitrate: number;
}

interface MediaSettingsState {
  audioQuality: AudioQualitySettings;
  camera: CameraSettings;        // NEW
  screenShare: ScreenShareSettings;
  // ... setters
}
```

---

## Part 2: Microphone Fix

### Root Cause

`voiceIsolation: false` was explicitly set in both `CreativeSpaceRoom.audio` and `handleToggleMic` options. The `voiceIsolation` constraint is Chrome-experimental (MediaCapture-Extensions). Passing `false` explicitly on unsupported browsers OR Chrome versions causes `getUserMedia` to throw `OverconstrainedError`, silently killing the mic.

### Fix

**Only pass `true`, never pass `false`.**

- `CreativeSpaceRoom`: omit `voiceIsolation` from `audio` prop
- `ControlBar.handleToggleMic`: build constraints conditionally:
  - `noiseMode === "suppression"` → set `noiseSuppression: true`
  - `noiseMode === "voiceIsolation"` → set `voiceIsolation: true`
  - `"off"` → neither
- `AudioMixer`: same conditional when re-creating mic track on mode change
- `getMicProcessor().getCaptureOptions()`: update to return minimal options (remove `noiseSuppression: true` — let the caller decide)

### Constraint building

```ts
function buildMicOptions(noiseMode: NoiseMode): AudioCaptureOptions {
  const opts: AudioCaptureOptions = {
    ...getMicProcessor().getCaptureOptions(),
  };
  if (noiseMode === "suppression") opts.noiseSuppression = true;
  if (noiseMode === "voiceIsolation") opts.voiceIsolation = true;
  return opts;
}
```

---

## Part 3: Camera Settings + Screen Stats

### 3a. Screen share stats display

Add resolution and FPS to screen share stat badge in `ParticipantList`:
```
Before: 🖥 2.5Mbps
After:  🖥 1080p30  2.5Mbps
```

The `useTrackStats` hook already collects `videoWidth`/`videoHeight`/`videoFps` for screen share tracks (when parsing). Only the render was missing.

### 3b. Apply camera settings

`ControlBar.handleToggleCamera` reads camera settings from store and passes them:

```ts
const cam = useMediaSettingsStore.getState().camera;
await localParticipant.setCameraEnabled(true, {
  resolution: {
    width: cam.resolution === "720p" ? 1280 : 1920,
    height: cam.resolution === "720p" ? 720 : 1080,
    frameRate: cam.frameRate,
  },
}, {
  videoEncoding: { maxBitrate: cam.bitrate },
});
```

---

## Files Changed

| File | Changes |
|------|---------|
| `components/space/MediaSettingsPanel.tsx` | Redesign: 3 sections, noise 3-way, camera section |
| `lib/store/media-settings.ts` | Add `CameraSettings`, `noiseMode`, setters |
| `components/space/CreativeSpaceRoom.tsx` | Remove `voiceIsolation: false` from audio prop |
| `components/space/ControlBar.tsx` | Conditional mic constraints, camera settings application |
| `components/space/AudioMixer.tsx` | Update noise toggles to 3-way, conditional constraint building |
| `lib/mic-processor.ts` | `getCaptureOptions()` remove noiseSuppression (caller sets it) |
| `components/space/ParticipantList.tsx` | Screen share stats: add resolution + FPS |
