# Creative Space UX Fixes v2 — Design Spec

**Date:** 2026-05-23
**Status:** Design approved

## Root Cause Analysis

### Mic not opening
The previous fix had two problems:
1. `audioEncoding` is NOT a valid LiveKit `AudioCaptureOptions` field — it doesn't exist anywhere in LiveKit source. It was silently ignored or caused constraint rejection.
2. The `getUserMedia` pre-warm hack + custom MicProcessor with `audio={false}` created a fragile init sequence where LiveKit's audio infrastructure wasn't ready when the processor tried to initialize.

### Stats not showing  
`useTrackStats` accessed private LiveKit internals (`engine.publisher.peerConnection`, `engine.subscriber.peerConnection`) via unsafe type casts. These properties may not exist in the installed LiveKit version, causing silent failure (swallowed by catch).

---

## Part 1: Mic Fix + Noise Suppression

### Architecture change

**Before:** `LiveKitRoom audio={false}` → manual `getUserMedia` pre-warm → `setMicrophoneEnabled(true, customOpts)`
**After:** `LiveKitRoom audio={processor+constraints}` → LiveKit manages audio lifecycle → `setMicrophoneEnabled(true)` (simple)

### Changes

| File | Change |
|------|--------|
| `CreativeSpaceRoom.tsx` | `audio={false}` → `audio={{ echoCancellation: true, noiseSuppression: true, voiceIsolation: false, autoGainControl: false, processor: getMicProcessor() }}`. Mute mic on connect. |
| `ControlBar.tsx` | Simplify `handleToggleMic` to bare `setMicrophoneEnabled(!isMicOn)`. Remove pre-warm hack, remove fake `audioEncoding`. |
| `AudioMixer.tsx` | Add noiseSuppression / voiceIsolation toggle switches in the Inputs section (below Local Microphone, above DAW Audio). |
| `lib/store/media-settings.ts` | Add `noiseSuppression: boolean` and `voiceIsolation: boolean` fields to audio quality settings. |
| `lib/mic-processor.ts` | No changes — volume gain + meter retained as-is. |

### Key invariants
- **DAW audio (VST) NEVER gets noise suppression.** The browser `noiseSuppression`/`voiceIsolation` constraints only apply to `getUserMedia` mic capture. DAW audio is published via `VstAudioBridge.publishTrack()` which bypasses getUserMedia entirely — no processing applied.
- **Mic gain range: 0–200%.** Existing behavior preserved.
- **Mic muted on room entry.** LiveKit requests permission and initializes the audio track, then immediately mutes via `setMicrophoneEnabled(false)`.

---

## Part 2: Realtime Stats Fix

### Change

Replace private engine internals with LiveKit's public track stats API.

**New data flow:**
```
useTrackStats(identity)
  → get participant from room
  → for each track publication:
      → pub.track.getStats()        (public API, LiveKit 1.5+)
      → parse RTCStatsReport
  → merge results → return TrackStats
```

**Fallback chain:**
1. `track.getStats()` — preferred public API
2. `room.getStats()` — LiveKit 1.5+ room-level stats (if available)
3. Engine internals with full try/catch — last resort

### Files Changed

| File | Change |
|------|--------|
| `lib/hooks/useTrackStats.ts` | Rewrite data source: use `pub.track.getStats()` instead of engine internals |
| `components/space/ParticipantList.tsx` | No changes needed (already imports and displays stats correctly) |

---

## Error Handling
- Mic toggle failure: `console.error` + no state corruption
- Stats polling failure: silent fallback to EMPTY_STATS
- Voice isolation unavailable (non-Chrome): toggle disabled/hidden or silently ignored by browser

## Regressions to avoid
- Don't break microphone gain (0-200%)
- Don't break DAW audio quality
- Don't add noise suppression to DAW audio
- Don't break SpotlightView
