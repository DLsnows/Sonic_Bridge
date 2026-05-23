# Creative Space UX Fixes v2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix microphone toggle (use LiveKit native audio, keep MicProcessor gain), add noise suppression toggles, and fix realtime stats (use public track API instead of engine internals).

**Architecture:** Two independent tasks. Task 1 switches `audio={false}` to `audio={processor+constraints}` on LiveKitRoom, simplifies handleToggleMic, adds noise toggles to AudioMixer. Task 2 rewrites useTrackStats to use `track.getStats()` public API.

**Tech Stack:** Next.js 16, React 19, LiveKit Client/Components, Zustand, TypeScript

---

## File Map

| Task | Branch | Modify |
|------|--------|--------|
| 1 | `fix/mic-noise-v2` | `CreativeSpaceRoom.tsx`, `ControlBar.tsx`, `AudioMixer.tsx`, `lib/store/media-settings.ts` |
| 2 | `fix/stats-v2` | `lib/hooks/useTrackStats.ts` |

No file conflicts. Tasks can run in parallel.

---

### Task 1: Mic Fix + Noise Suppression Toggles

**Files:**
- Modify: `components/space/CreativeSpaceRoom.tsx:143-157`
- Modify: `components/space/ControlBar.tsx:37-52`
- Modify: `components/space/AudioMixer.tsx:87-156` (Inputs section)
- Modify: `lib/store/media-settings.ts`

#### Step 1: Add noise suppression fields to media-settings store

In `lib/store/media-settings.ts`, add to `AudioQualitySettings` interface and state:

```ts
interface AudioQualitySettings {
  bitrate: number;
  sendBufferMs: BufferMs;
  receiveBufferMs: BufferMs;
  noiseSuppression: boolean;   // NEW — default true
  voiceIsolation: boolean;      // NEW — default false
}
```

Add setters to `MediaSettingsState`:

```ts
setNoiseSuppression: (enabled: boolean) => void;
setVoiceIsolation: (enabled: boolean) => void;
```

Default values in the `create` call:

```ts
audioQuality: {
  bitrate: DEFAULT_AUDIO_BITRATE,
  sendBufferMs: DEFAULT_SEND_BUFFER_MS,
  receiveBufferMs: DEFAULT_RECEIVE_BUFFER_MS,
  noiseSuppression: true,        // NEW
  voiceIsolation: false,         // NEW
},
```

And the setter implementations:

```ts
setNoiseSuppression: (noiseSuppression) =>
  set((s) => ({ audioQuality: { ...s.audioQuality, noiseSuppression } })),
setVoiceIsolation: (voiceIsolation) =>
  set((s) => ({ audioQuality: { ...s.audioQuality, voiceIsolation } })),
```

#### Step 2: Change CreativeSpaceRoom — LiveKitRoom audio config

In `components/space/CreativeSpaceRoom.tsx`, change the `LiveKitRoom` props:

**Replace:**
```tsx
<LiveKitRoom
  serverUrl={tokenData.wsUrl}
  token={tokenData.token}
  connect={true}
  audio={false}
  video={false}
  onConnected={() => {
    setConnected(true);
    useSpaceStore.getState().setVideoWatchEnabled(true);
  }}
```

**With:**
```tsx
<LiveKitRoom
  serverUrl={tokenData.wsUrl}
  token={tokenData.token}
  connect={true}
  audio={{
    echoCancellation: true,
    noiseSuppression: true,
    voiceIsolation: false,
    autoGainControl: false,
    processor: getMicProcessor(),
  }}
  video={false}
  onConnected={() => {
    setConnected(true);
    useSpaceStore.getState().setVideoWatchEnabled(true);
  }}
```

In `ControlBar.tsx`, add a `useEffect` that mutes mic on first connect (LiveKit auto-acquires mic due to `audio={true}`):

```tsx
// Mute mic on room entry — audio track is initialized but muted
useEffect(() => {
  if (isConnected && localParticipant && isMicrophoneEnabled) {
    localParticipant.setMicrophoneEnabled(false).catch(() => {});
  }
}, [isConnected]); // eslint-disable-line react-hooks/exhaustive-deps
```

This fires once when `isConnected` flips to `true`. Since `audio={true}` with processor, the mic track is already acquired but we mute it immediately.

#### Step 3: Simplify handleToggleMic in ControlBar

In `components/space/ControlBar.tsx`, replace the entire `handleToggleMic` function:

**Replace:**
```tsx
async function handleToggleMic() {
    try {
      if (!isMicrophoneEnabled) {
        const preStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        preStream.getTracks().forEach((t) => t.stop());
        const { bitrate } = useMediaSettingsStore.getState().audioQuality;
        const micOptions = {
          ...getMicProcessor().getCaptureOptions(),
          audioEncoding: { maxBitrate: bitrate },
        };
        await localParticipant.setMicrophoneEnabled(true, micOptions);
      } else {
        await localParticipant.setMicrophoneEnabled(false);
      }
    } catch (e) { console.error(e); }
  }
```

**With:**
```tsx
async function handleToggleMic() {
    try {
      if (!isMicrophoneEnabled) {
        const aq = useMediaSettingsStore.getState().audioQuality;
        await localParticipant.setMicrophoneEnabled(true, {
          echoCancellation: true,
          noiseSuppression: aq.noiseSuppression,
          voiceIsolation: aq.voiceIsolation,
          autoGainControl: false,
          processor: getMicProcessor(),
        });
      } else {
        await localParticipant.setMicrophoneEnabled(false);
      }
    } catch (e) { console.error("Mic toggle failed:", e); }
  }
```

This reads the latest noise suppression settings from the Zustand store every time mic is enabled.

#### Step 4: Add noise suppression toggles to AudioMixer

In `components/space/AudioMixer.tsx`, add toggle switches in the Inputs section, between the Local Microphone slider and the DAW Audio section.

Add imports at the top:
```tsx
const noiseSuppression = useMediaSettingsStore((s) => s.audioQuality.noiseSuppression);
const voiceIsolation = useMediaSettingsStore((s) => s.audioQuality.voiceIsolation);
const setNoiseSuppression = useMediaSettingsStore((s) => s.setNoiseSuppression);
const setVoiceIsolation = useMediaSettingsStore((s) => s.setVoiceIsolation);
```

In the Inputs section, after the Local Microphone gain slider and before the DAW Audio section, add:

```tsx
{/* Noise Suppression toggles */}
<div className="space-y-1.5 pt-1">
  <div className="flex items-center justify-between">
    <span className="text-[10px] text-[#F0F0F0] font-['Share_Tech_Mono',monospace]">
      Noise Suppression
    </span>
    <button
      onClick={() => setNoiseSuppression(!noiseSuppression)}
      className={`w-8 h-4 rounded-full transition-colors relative ${
        noiseSuppression ? "bg-[#00FF41]/30" : "bg-white/10"
      }`}
    >
      <span
        className={`absolute top-0.5 w-3 h-3 rounded-full transition-all ${
          noiseSuppression ? "left-4 bg-[#00FF41]" : "left-0.5 bg-[#A0A0B0]"
        }`}
      />
    </button>
  </div>
  <div className="flex items-center justify-between">
    <span className="text-[10px] text-[#A0A0B0] font-['Share_Tech_Mono',monospace]">
      Voice Isolation (Chrome)
    </span>
    <button
      onClick={() => setVoiceIsolation(!voiceIsolation)}
      className={`w-8 h-4 rounded-full transition-colors relative ${
        voiceIsolation ? "bg-[#B44DFF]/30" : "bg-white/10"
      }`}
    >
      <span
        className={`absolute top-0.5 w-3 h-3 rounded-full transition-all ${
          voiceIsolation ? "left-4 bg-[#B44DFF]" : "left-0.5 bg-[#A0A0B0]"
        }`}
      />
    </button>
  </div>
</div>
```

**IMPORTANT:** These toggles ONLY affect local microphone. They DO NOT affect DAW audio (which is published via VstAudioBridge.publishTrack, bypassing getUserMedia entirely).

#### Step 5: Handle toggle changes — re-apply audio constraints

When the user toggles noiseSuppression/voiceIsolation, the audio track needs to be re-created with new constraints. The simplest approach: when the toggle changes, if mic is currently enabled, cycle it off and back on.

In AudioMixer.tsx, add an effect:

```tsx
useEffect(() => {
  const room = (window as any).__lk_room;
  if (!room?.localParticipant) return;
  const lp = room.localParticipant;
  if (!lp.isMicrophoneEnabled) return;
  // Re-create audio track with new constraints
  lp.setMicrophoneEnabled(false).then(() => {
    const aq = useMediaSettingsStore.getState().audioQuality;
    const opts = {
      echoCancellation: true,
      noiseSuppression: aq.noiseSuppression,
      voiceIsolation: aq.voiceIsolation,
      autoGainControl: false,
      processor: getMicProcessor(),
    };
    lp.setMicrophoneEnabled(true, opts);
  }).catch(() => {});
}, [noiseSuppression, voiceIsolation]);
```

**Wait** — accessing `(window as any).__lk_room` is hacky. Better approach: use `useMaybeRoomContext()` to get the room (AudioMixer is already inside LiveKitRoom context).

```tsx
import { useMaybeRoomContext } from "@livekit/components-react";

// Inside AudioMixer component:
const room = useMaybeRoomContext();

useEffect(() => {
  if (!room?.localParticipant) return;
  const lp = room.localParticipant;
  if (!lp.isMicrophoneEnabled) return;
  lp.setMicrophoneEnabled(false).then(() => {
    const aq = useMediaSettingsStore.getState().audioQuality;
    lp.setMicrophoneEnabled(true, {
      echoCancellation: true,
      noiseSuppression: aq.noiseSuppression,
      voiceIsolation: aq.voiceIsolation,
      autoGainControl: false,
      processor: getMicProcessor(),
    });
  }).catch(() => {});
}, [noiseSuppression, voiceIsolation, room]);
```

#### Step 6: TypeScript check

```bash
npx tsc --noEmit
```

Expected: no errors in modified files.

#### Step 7: Commit

```bash
git add components/space/CreativeSpaceRoom.tsx components/space/ControlBar.tsx components/space/AudioMixer.tsx lib/store/media-settings.ts
git commit -m "fix: use LiveKit native audio pipeline, simplify mic toggle, add noise suppression toggles to mixer"
```

---

### Task 2: Fix Realtime Stats — Use Public Track API

**Files:**
- Modify: `lib/hooks/useTrackStats.ts` (full rewrite of data source)

#### Step 1: Rewrite useTrackStats to use track.getStats()

Replace the entire file `lib/hooks/useTrackStats.ts`. Keep the same interface (`TrackStats`, `useTrackStats` signature). Only change the data source inside `poll()`.

```ts
"use client";

import { useState, useEffect, useRef } from "react";
import { useMaybeRoomContext } from "@livekit/components-react";
import { Track } from "livekit-client";

interface TrackStats {
  audioBitrate: number | null;
  videoBitrate: number | null;
  videoWidth: number | null;
  videoHeight: number | null;
  videoFps: number | null;
  screenShareBitrate: number | null;
}

const EMPTY_STATS: TrackStats = {
  audioBitrate: null,
  videoBitrate: null,
  videoWidth: null,
  videoHeight: null,
  videoFps: null,
  screenShareBitrate: null,
};

function parseEntry(
  entry: Record<string, unknown>,
  prevMap: Map<number, { bytes: number; ts: number }>,
): { bitrate: number | undefined; width: number | undefined; height: number | undefined; fps: number | undefined } {
  const ssrc = entry.ssrc as number | undefined;
  let bitrate: number | undefined;
  let width: number | undefined;
  let height: number | undefined;
  let fps: number | undefined;

  // Chrome native bitrate
  if (typeof entry.bitrate === "number") bitrate = entry.bitrate;

  // Bytes-delta fallback (Firefox/Safari)
  const bytes = (entry.bytesReceived ?? entry.bytesSent) as number | undefined;
  const ts = entry.timestamp as number | undefined;
  if (bitrate === undefined && typeof bytes === "number" && typeof ts === "number" && ssrc !== undefined) {
    const prev = prevMap.get(ssrc);
    prevMap.set(ssrc, { bytes, ts });
    if (prev) {
      const byteDelta = bytes - prev.bytes;
      const timeDelta = (ts - prev.ts) / 1000;
      if (timeDelta > 0 && byteDelta >= 0) {
        bitrate = Math.round((byteDelta * 8) / timeDelta);
      }
    }
  }

  // Resolution / FPS
  if (typeof entry.frameWidth === "number") width = entry.frameWidth;
  if (typeof entry.frameHeight === "number") height = entry.frameHeight;
  if (typeof entry.framesPerSecond === "number") fps = entry.framesPerSecond;

  return { bitrate, width, height, fps };
}

export function useTrackStats(participantIdentity: string): TrackStats {
  const room = useMaybeRoomContext();
  const [stats, setStats] = useState<TrackStats>(EMPTY_STATS);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevBytesRef = useRef<Map<number, { bytes: number; ts: number }>>(new Map());

  useEffect(() => {
    const r = room;
    if (!r) return;
    prevBytesRef.current = new Map();

    async function poll() {
      try {
        const isLocal = r.localParticipant?.identity === participantIdentity;
        const participant = isLocal
          ? r.localParticipant
          : r.remoteParticipants.get(participantIdentity);
        if (!participant) return;

        const result: TrackStats = { ...EMPTY_STATS };

        // Process audio track publications
        for (const [, pub] of participant.audioTrackPublications) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const track = (pub as any).track;
            let report: RTCStatsReport | null = null;

            // 1. Try public track.getStats() (LiveKit 1.5+)
            if (track && typeof track.getStats === "function") {
              report = await track.getStats();
            }

            // 2. Fallback: try room.getStats()
            if (!report) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const roomAny = r as any;
              if (typeof roomAny.getStats === "function") {
                report = await roomAny.getStats();
              }
            }

            // 3. Last resort: engine internals
            if (!report) {
              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const eng = r.engine as any;
                const pc = isLocal
                  ? eng.publisher?.peerConnection
                  : eng.subscriber?.peerConnection;
                if (pc && typeof pc.getStats === "function") {
                  report = await pc.getStats();
                }
              } catch { /* ignore */ }
            }

            if (!report) continue;

            for (const [, entry] of report) {
              if (entry.type !== (isLocal ? "outbound-rtp" : "inbound-rtp")) continue;
              if ((entry as Record<string, unknown>).kind !== "audio") continue;
              const parsed = parseEntry(entry as Record<string, unknown>, prevBytesRef.current);
              if (parsed.bitrate !== undefined) result.audioBitrate = parsed.bitrate;
            }
          } catch { /* per-track stats can fail */ }
        }

        // Process video track publications
        for (const [, pub] of participant.videoTrackPublications) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const track = (pub as any).track;
            let report: RTCStatsReport | null = null;
            if (track && typeof track.getStats === "function") {
              report = await track.getStats();
            }
            if (!report) continue;

            const isScreen = pub.source === Track.Source.ScreenShare;

            for (const [, entry] of report) {
              if (entry.type !== (isLocal ? "outbound-rtp" : "inbound-rtp")) continue;
              if ((entry as Record<string, unknown>).kind !== "video") continue;
              const parsed = parseEntry(entry as Record<string, unknown>, prevBytesRef.current);
              if (isScreen) {
                if (parsed.bitrate !== undefined) result.screenShareBitrate = parsed.bitrate;
              } else {
                if (parsed.bitrate !== undefined) result.videoBitrate = parsed.bitrate;
                if (parsed.width !== undefined) result.videoWidth = parsed.width;
                if (parsed.height !== undefined) result.videoHeight = parsed.height;
                if (parsed.fps !== undefined) result.videoFps = parsed.fps;
              }
            }
          } catch { /* per-track stats can fail */ }
        }

        setStats(result);
      } catch {
        // Stats polling can fail transiently — ignore
      }
    }

    poll();
    intervalRef.current = setInterval(poll, 2000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [room, participantIdentity]);

  return stats;
}
```

#### Step 2: TypeScript check

```bash
npx tsc --noEmit
```

Expected: no errors in `lib/hooks/useTrackStats.ts`.

#### Step 3: Commit

```bash
git add lib/hooks/useTrackStats.ts
git commit -m "fix: use LiveKit public track.getStats() API instead of engine internals for quality stats"
```

---

## Final Verification

After both tasks are merged:

```bash
npx tsc --noEmit
```

Expected: clean pass.
