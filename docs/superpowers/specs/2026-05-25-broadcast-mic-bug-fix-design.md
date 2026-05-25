# Broadcast Toggle Race + Mic Permanent Failure — Design Spec

**Date:** 2026-05-25
**Status:** Approved by user (verbal, 2026-05-25)
**Base branch:** `fix/creative-space-v8` (forked from `fix/creative-space-v7` after closing PR #172)

## Reported Symptoms

1. **Bug A — Broadcast off→on doesn't restore DAW audio.** User clicks "Broadcast to Room" off, then on; the DAW (VST) audio track never makes it back to other participants.
2. **Bug B — Mic permanently silent after co-active with broadcast.** Once the microphone and broadcast have been simultaneously enabled, the microphone stops producing audio. Even after disabling broadcast, mic stays silent. UI still shows mic as on; reload restores mic.

## Root-Cause Analysis

### Bug A — race in `components/space/VstAudioBridge.tsx`

Confirmed by every PR-Agent / Claude review on PR #172. Two race conditions:

```ts
useEffect(() => {
  if (!broadcastEnabled && publishedTrackRef.current) {
    const track = publishedTrackRef.current;
    participantRef.current.unpublishTrack(track).then(() => {
      publishedTrackRef.current = null;  // (A) cleared async
    });
  }
  if (broadcastEnabled && !publishedTrackRef.current) {
    const timer = setTimeout(() => { /* refreshTrack + publishTrack */ }, 500);
  }
}, [broadcastEnabled]);

bridge.onPcmData(...) {
  // (B) Second publish path
  if (pipeline.isReady && !publishedTrackRef.current && store.broadcastEnabled) {
    const track = pipeline.getMediaStreamTrack(); // not refreshTrack!
    participantRef.current.publishTrack(track, ...);
  }
}
```

- **Race 1 (fast toggle):** `publishedTrackRef.current` is nulled inside `.then()` of `unpublishTrack`. If `broadcastEnabled` flips back to `true` before the promise resolves, the on-branch guard `!publishedTrackRef.current` is still falsy → re-publish skipped. When unpublish later resolves, the effect does not re-run (dependency hasn't changed).
- **Race 2 (timer vs PCM callback):** The 500ms timer calls `refreshTrack()` (new destination → new MediaStreamTrack). The PCM callback uses `getMediaStreamTrack()` on the current destination. If the callback fires before the timer, it publishes a stale destination's track; if it fires after, both paths may race the same publish.

### Bug B — mic silent but UI on, recovers on reload

User-confirmed conditions narrow root cause to **front-end session state**, not browser device contention or LiveKit server state.

Candidate root causes (to be confirmed by Agent 1's diagnostics):

1. **AudioContext auto-suspend.** When the VST `AudioContext` is created (or resumed), the mic's `AudioContext` may be auto-suspended by the browser if both share the same output device and have different sample rates.
2. **Track muted by browser.** `MediaStreamTrack.muted` may flip to `true` when a competing capture (DAW pipeline indirectly) interrupts the OS audio session. LiveKit treats `muted` differently from `enabled`; the publication stays alive but no PCM flows.
3. **Audio graph disconnected.** Some path in `MicPipeline` (source → gain → analyser → destination) may be invalidated (e.g., underlying `MediaStream` track ended) without the pipeline noticing.
4. **LiveKit republish side-effect.** The `audioBitrate` option passed as `as any` cast may cause a publish to trigger an internal renegotiation that silently mutes another sender on the same connection.

## Design

### Fix A (Broadcast race) — `fix/broadcast-race-v8`

**Principle: single source of truth + synchronous state.** Effect drives all publish/unpublish. PCM callback becomes a pure data feeder. Timer replaced by pipeline-ready event.

Changes (all in `components/space/VstAudioBridge.tsx` + `lib/audio-pipeline.ts`):

1. `lib/audio-pipeline.ts`: add `onReady(cb)` registration that fires once when `initialize()` finishes. Add `isReady` flag (already present).
2. `components/space/VstAudioBridge.tsx`:
   - Remove the publish branch from `onPcmData` callback. It only feeds PCM.
   - In the broadcast effect:
     - **Synchronously** null `publishedTrackRef.current` before `unpublishTrack` resolves.
     - When re-enabling, if pipeline is not yet ready, queue the publish via `pipeline.onReady(() => publish())` instead of `setTimeout`.
     - Always use `pipeline.refreshTrack()` to obtain the track to publish (avoids re-using a previously unpublished `MediaStreamTrack`).
   - Track an in-flight unpublish promise so we cancel the next pending publish if broadcast goes off again before it resolves.

### Fix B (mic hardening + diagnostics)

#### Diagnostic — `fix/creative-space-v8` (Agent 1)

Add `lib/dev-debug.ts` and `components/space/DevDebugPanel.tsx`. Both gated by `process.env.NODE_ENV === 'development'`. Mounted from `components/space/CreativeSpaceRoom.tsx`. Logs:

- `useVstStore` and `useMediaSettingsStore` change events
- `useLocalParticipant` derived state every render
- A periodic 1s heartbeat that reports: every local publication's `track.muted`, `track.readyState`, the participant's published source kinds. (We can subscribe to publication-changed events instead of polling — preferred.)

Output is a markdown-style log to console + a small on-screen panel showing current state.

User reproduces Bug B with the panel + console open, pastes log back.

#### Defensive guards — `fix/mic-pipeline-guards-v8` (Agent 3)

In `lib/mic-pipeline.ts`:

1. On `start()`, attach listeners for `audioContext.onstatechange` → if `suspended` (and pipeline still running), call `audioContext.resume()`. Surface state changes via `useVstStore`.
2. Listen to `processedTrack` and `sourceTrack` for `mute`/`unmute`/`ended` events. On `mute`, log. On `ended`, mark pipeline broken and surface error.
3. Add `verifyAudioGraph()` method — returns true iff `audioContext.state === 'running' && sourceNode && gainNode && destination && processedTrack && processedTrack.readyState === 'live' && !processedTrack.muted`.

No behavioural change unless states drift; this is purely diagnostic + auto-recovery.

In `components/space/AudioMixer.tsx` (`restartMic` effect): leave dependency array at `[noiseMode]` (already done in v7). No change.

### Conflict surface between agents

| File | Agent 1 | Agent 2 | Agent 3 |
|---|---|---|---|
| `lib/dev-debug.ts` (new) | ✓ | — | — |
| `components/space/DevDebugPanel.tsx` (new) | ✓ | — | — |
| `components/space/CreativeSpaceRoom.tsx` | mount panel (1 line) | — | — |
| `components/space/VstAudioBridge.tsx` | — | ✓ rewrite effect | — |
| `lib/audio-pipeline.ts` | — | ✓ add `onReady` | — |
| `lib/mic-pipeline.ts` | — | — | ✓ listeners + verify |

Zero overlap. Each sub-branch can merge back into `fix/creative-space-v8` independently.

## Out of Scope

- Stats SSRC / kind-fallback issues (`lib/hooks/useTrackStats.ts`). Reviewer flagged but unrelated to reported bugs. Defer.
- `sendBufferMs` missing `setSendBufferSize` call. Same — defer.
- v7 commits (audioContext.resume insertions, refreshTrack, ring-buffer drain). Keep them all — they are still useful and don't cause the reported bugs.
