# Creative Space UX Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix mic toggle, add spotlight/pin view, and show realtime per-participant upload quality stats in the Creative Space.

**Architecture:** Three independent branches. Task 1 fixes mic toggle + applies audio settings to LiveKit encoder. Task 2 builds a new SpotlightView component with Discord-style main+strip layout. Task 3 adds a stats polling hook and renders stats badges in the ParticipantList sidebar.

**Tech Stack:** Next.js 16, React 19, LiveKit Client/Components, Zustand, TypeScript

---

## File Map

| Task | Branch | Create | Modify |
|------|--------|--------|--------|
| 1 | `fix/mic-and-settings` | — | `components/space/ControlBar.tsx`, `lib/mic-processor.ts` |
| 2 | `feat/spotlight-view` | `components/space/SpotlightView.tsx` | `components/space/CreativeSpaceRoom.tsx` |
| 3 | `feat/stats-display` | `lib/hooks/useTrackStats.ts` | `components/space/ParticipantList.tsx` |

Tasks have no file conflicts. They can be developed in parallel.

---

### Task 1: Mic Toggle Fix + Audio Settings Application

**Files:**
- Modify: `components/space/ControlBar.tsx:37-48`
- Modify: `lib/mic-processor.ts:24-51`

- [ ] **Step 1: Add error logging to handleToggleMic**

In `components/space/ControlBar.tsx`, replace the empty catch in `handleToggleMic`:

```tsx
async function handleToggleMic() {
    try {
      if (!isMicrophoneEnabled) {
        // Pre-warm browser mic permission before LiveKit tries
        try {
          const preStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          preStream.getTracks().forEach((t) => t.stop());
        } catch {
          // Permission denied or no device — let LiveKit handle the error
        }

        const aq = useMediaSettingsStore.getState().audioQuality;
        await localParticipant.setMicrophoneEnabled(
          true,
          {
            ...getMicProcessor().getCaptureOptions(),
            audioEncoding: { maxBitrate: aq.bitrate },
          } as AudioCaptureOptions & { audioEncoding?: { maxBitrate: number } },
        );
      } else {
        await localParticipant.setMicrophoneEnabled(false);
      }
    } catch (e) {
      console.error("Mic toggle failed:", e);
    }
  }
```

Import `useMediaSettingsStore` at the top of ControlBar.tsx (it's already imported at line 7).

Import `AudioCaptureOptions` from livekit-client if not already available in scope:
```tsx
import type { AudioCaptureOptions } from "livekit-client";
```

- [ ] **Step 2: Add fallback mode to MicProcessor.init()**

In `lib/mic-processor.ts`, wrap the `init` method body in try/catch with a pass-through fallback:

```ts
async init(opts: AudioProcessorOptions): Promise<void> {
    const { audioContext, track } = opts;
    this.audioContext = audioContext;

    try {
      this.sourceNode = audioContext.createMediaStreamSource(
        new MediaStream([track]),
      );

      this.analyserNode = audioContext.createAnalyser();
      this.analyserNode.fftSize = 256;
      this.analyserNode.smoothingTimeConstant = 0.4;
      this.meterDataArray = new Uint8Array(
        new ArrayBuffer(this.analyserNode.fftSize),
      );

      this.gainNode = audioContext.createGain();
      this.gainNode.gain.value = useVstStore.getState().micVolume;

      this.destination = audioContext.createMediaStreamDestination();

      this.sourceNode.connect(this.analyserNode);
      this.analyserNode.connect(this.gainNode);
      this.gainNode.connect(this.destination);

      this.processedTrack = this.destination.stream.getAudioTracks()[0];

      this.startMeterLoop();
    } catch (e) {
      // Fallback: pass-through without DSP (gain/meter won't work, but mic will)
      console.warn("MicProcessor init failed, using pass-through:", e);
      this.processedTrack = track;
    }
  }
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/space/ControlBar.tsx lib/mic-processor.ts
git commit -m "fix: mic toggle reliability — pre-warm permission, apply audio bitrate, add fallback DSP, log errors"
```

---

### Task 2: Spotlight View (Discord-Style)

**Files:**
- Create: `components/space/SpotlightView.tsx`
- Modify: `components/space/CreativeSpaceRoom.tsx:178` (replace `ParticipantGrid`)

- [ ] **Step 1: Create SpotlightView component**

Create `components/space/SpotlightView.tsx`:

```tsx
"use client";

import { useState, useCallback } from "react";
import { useTracks, ParticipantTile } from "@livekit/components-react";
import { Track } from "livekit-client";

export function SpotlightView() {
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);

  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: true },
  );

  // Auto-spotlight screen share when it appears
  const screenShareTrack = tracks.find(
    (t) => t.source === Track.Source.ScreenShare,
  );
  if (screenShareTrack && activeTrackId !== screenShareTrack.publication.trackSid) {
    // Use setTimeout to avoid setState during render
    setTimeout(() => {
      setActiveTrackId(screenShareTrack.publication.trackSid ?? null);
    }, 0);
  }

  const activeTrack = activeTrackId
    ? tracks.find((t) => t.publication.trackSid === activeTrackId)
    : null;

  const handleDoubleClick = useCallback(
    (trackSid: string | undefined) => {
      if (!trackSid) return;
      if (activeTrackId === trackSid) {
        setActiveTrackId(null); // exit spotlight
      } else {
        setActiveTrackId(trackSid); // enter spotlight
      }
    },
    [activeTrackId],
  );

  const handleExitSpotlight = useCallback(() => {
    setActiveTrackId(null);
  }, []);

  // No spotlight: show standard grid
  if (!activeTrack || tracks.length <= 2) {
    const gridCols =
      tracks.length <= 1
        ? "grid-cols-1"
        : tracks.length <= 2
          ? "grid-cols-1 md:grid-cols-2"
          : tracks.length <= 4
            ? "grid-cols-2"
            : "grid-cols-2 lg:grid-cols-3";

    return (
      <div className={`grid ${gridCols} gap-4 p-4 auto-rows-fr`}>
        {tracks.map((trackRef) => (
          <div
            key={trackRef.participant.identity + trackRef.source}
            className="rounded-xl overflow-hidden cursor-pointer group relative"
            onDoubleClick={() =>
              handleDoubleClick(trackRef.publication.trackSid ?? undefined)
            }
          >
            <ParticipantTile trackRef={trackRef} />
            {tracks.length > 2 && (
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center bg-black/30">
                <span className="text-[10px] text-[#00F0FF] font-mono bg-black/60 px-2 py-1 rounded">
                  Double-click to pin
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  // Spotlight mode
  const thumbnails = tracks.filter(
    (t) => t.publication.trackSid !== activeTrackId,
  );

  return (
    <div className="flex flex-col h-full p-4 gap-3">
      {/* Main spotlight area */}
      <div className="flex-1 relative rounded-xl overflow-hidden min-h-0">
        <ParticipantTile trackRef={activeTrack} />
        {/* Exit button */}
        <button
          onClick={handleExitSpotlight}
          className="absolute top-3 right-3 z-10 px-3 py-1.5 rounded-lg bg-black/60 text-[#00F0FF] text-[11px] font-['Share_Tech_Mono',monospace] border border-[#00F0FF]/20 hover:bg-black/80 hover:border-[#00F0FF]/40 transition-all"
        >
          Exit Spotlight
        </button>
        {/* Name + source label */}
        <div className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded bg-black/60 text-xs font-mono text-[#F0F0F0]">
          {activeTrack.participant.name ?? activeTrack.participant.identity}
          {activeTrack.source === Track.Source.ScreenShare && (
            <span className="ml-2 text-[#00F0FF]">Screen Share</span>
          )}
        </div>
      </div>

      {/* Thumbnail strip */}
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ height: 80 }}>
        {thumbnails.map((trackRef) => (
          <div
            key={trackRef.participant.identity + trackRef.source}
            className="flex-shrink-0 w-[120px] rounded-lg overflow-hidden cursor-pointer border-2 border-transparent hover:border-[#00F0FF]/50 transition-all"
            onClick={() =>
              handleDoubleClick(trackRef.publication.trackSid ?? undefined)
            }
          >
            <ParticipantTile trackRef={trackRef} disableSpeakingIndicator />
          </div>
        ))}
        {/* Active track thumbnail (highlighted) */}
        <div
          className="flex-shrink-0 w-[120px] rounded-lg overflow-hidden cursor-pointer border-2 border-[#00F0FF]"
          onClick={handleExitSpotlight}
        >
          <ParticipantTile trackRef={activeTrack} disableSpeakingIndicator />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Replace ParticipantGrid in CreativeSpaceRoom**

In `components/space/CreativeSpaceRoom.tsx`:
- Replace `import { ParticipantGrid } from "./ParticipantGrid";` with `import { SpotlightView } from "./SpotlightView";`
- Replace `<ParticipantGrid />` on line 178 with `<SpotlightView />`

Keep the `ParticipantGrid.tsx` file — it may still be used as a fallback (the SpotlightView already handles grid mode internally).

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/space/SpotlightView.tsx components/space/CreativeSpaceRoom.tsx
git commit -m "feat: spotlight view with Discord-style main+strip layout for creative space"
```

---

### Task 3: Realtime Stats Display in Participant Sidebar

**Files:**
- Create: `lib/hooks/useTrackStats.ts`
- Modify: `components/space/ParticipantList.tsx`

- [ ] **Step 1: Create useTrackStats hook**

Create `lib/hooks/useTrackStats.ts`.

**Data source strategy:**
- For **local participant**: read `outbound-rtp` stats from the publisher PC (what we're sending)
- For **remote participants**: read `inbound-rtp` stats from the subscriber PC (what we receive from them = their upload)
- Match tracks by SSRC from the participant's track publications

```ts
"use client";

import { useState, useEffect, useRef } from "react";
import { useMaybeRoomContext } from "@livekit/components-react";
import type { RemoteTrackPublication, LocalTrackPublication } from "livekit-client";

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

function collectSsrcs(
  participant: { audioTrackPublications: Map<string, LocalTrackPublication | RemoteTrackPublication>; videoTrackPublications: Map<string, LocalTrackPublication | RemoteTrackPublication> },
): { audioSsrcs: Set<number>; videoSsrcs: Set<number>; screenSsrcs: Set<number> } {
  const audioSsrcs = new Set<number>();
  const videoSsrcs = new Set<number>();
  const screenSsrcs = new Set<number>();

  for (const [, pub] of participant.audioTrackPublications) {
    const ssrc = (pub as RemoteTrackPublication).track?.info?.ssrc;
    if (ssrc) audioSsrcs.add(ssrc);
  }
  for (const [, pub] of participant.videoTrackPublications) {
    const ssrc = (pub as RemoteTrackPublication).track?.info?.ssrc;
    if (!ssrc) continue;
    if (pub.source === 2 /* ScreenShare */ || (pub as RemoteTrackPublication).track?.source === 2) {
      screenSsrcs.add(ssrc);
    } else {
      videoSsrcs.add(ssrc);
    }
  }

  return { audioSsrcs, videoSsrcs, screenSsrcs };
}

function parseRtpStats(
  stats: RTCStatsReport,
  ssrcs: { audioSsrcs: Set<number>; videoSsrcs: Set<number>; screenSsrcs: Set<number> },
  isLocal: boolean,
): TrackStats {
  const entryType = isLocal ? "outbound-rtp" : "inbound-rtp";
  let audioBitrate: number | null = null;
  let videoBitrate: number | null = null;
  let videoWidth: number | null = null;
  let videoHeight: number | null = null;
  let videoFps: number | null = null;
  let screenShareBitrate: number | null = null;

  for (const [, entry] of stats) {
    if (entry.type !== entryType) continue;
    const e = entry as Record<string, unknown>;
    const ssrc = e.ssrc as number | undefined;
    if (ssrc === undefined) continue;

    if (ssrcs.audioSsrcs.has(ssrc)) {
      if (e.bitrate !== undefined) audioBitrate = e.bitrate as number;
    } else if (ssrcs.videoSsrcs.has(ssrc)) {
      if (e.bitrate !== undefined) videoBitrate = e.bitrate as number;
      if (e.frameWidth !== undefined) videoWidth = e.frameWidth as number;
      if (e.frameHeight !== undefined) videoHeight = e.frameHeight as number;
      if (e.framesPerSecond !== undefined) videoFps = e.framesPerSecond as number;
    } else if (ssrcs.screenSsrcs.has(ssrc)) {
      if (e.bitrate !== undefined) screenShareBitrate = e.bitrate as number;
      if (!videoWidth && e.frameWidth !== undefined) {
        videoWidth = e.frameWidth as number;
        videoHeight = e.frameHeight as number;
        videoFps = e.framesPerSecond as number;
      }
    }
  }

  return { audioBitrate, videoBitrate, videoWidth, videoHeight, videoFps, screenShareBitrate };
}

export function useTrackStats(participantIdentity: string): TrackStats {
  const room = useMaybeRoomContext();
  const [stats, setStats] = useState<TrackStats>(EMPTY_STATS);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!room) return;

    async function poll() {
      try {
        const isLocal = room!.localParticipant?.identity === participantIdentity;
        const participant = isLocal
          ? room!.localParticipant
          : room!.remoteParticipants.get(participantIdentity);

        if (!participant) return;

        const ssrcs = collectSsrcs(participant);

        // Get appropriate peer connection: publisher for local, subscriber for remote
        const pc = isLocal
          ? (room!.engine as unknown as Record<string, unknown>)?.publisher?.peerConnection as RTCPeerConnection | undefined
          : (room!.engine as unknown as Record<string, unknown>)?.subscriber?.peerConnection as RTCPeerConnection | undefined;

        if (!pc || typeof pc.getStats !== "function") return;

        const statsReport = await pc.getStats();
        setStats(parseRtpStats(statsReport, ssrcs, isLocal));
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

- [ ] **Step 2: Add stats row to ParticipantRow in ParticipantList**

In `components/space/ParticipantList.tsx`:

**Step 2a:** Import the hook at the top:
```tsx
import { useTrackStats } from "@/lib/hooks/useTrackStats";
```

**Step 2b:** Inside `ParticipantRow`, call the hook and render a stats line below the name:

Replace the existing `ParticipantRow` return JSX (lines 29-98). The change adds a stats row inside the outer div, after the main flex row:

```tsx
function ParticipantRow({
  participant,
  isLocal,
}: {
  participant: Participant;
  isLocal: boolean;
}) {
  const name = participant.name ?? participant.identity ?? "Unknown";
  const initial = name.charAt(0).toUpperCase();
  const isSpeaking = participant.isSpeaking;
  const audioLevel = isSpeaking ? (participant.audioLevel ?? 0) : 0;
  const isMicOn = participant.isMicrophoneEnabled;
  const isCameraOn = participant.isCameraEnabled;
  const isScreenOn = participant.isScreenShareEnabled;
  const trackStats = useTrackStats(participant.identity);

  function formatBitrate(bps: number | null): string {
    if (bps === null) return "";
    if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)}Mbps`;
    return `${Math.round(bps / 1000)}kbps`;
  }

  function formatResolution(w: number | null, h: number | null): string {
    if (w === null || h === null) return "";
    if (h <= 480) return `${h}p`;
    if (h <= 720) return "720p";
    if (h <= 1080) return "1080p";
    return `${h}p`;
  }

  function formatFps(fps: number | null): string {
    if (fps === null) return "";
    return `${Math.round(fps)}fps`;
  }

  const hasStats =
    trackStats.audioBitrate !== null ||
    trackStats.videoBitrate !== null ||
    trackStats.screenShareBitrate !== null;

  return (
    <div>
      <div className="flex items-center gap-3 px-3 py-2 hover:bg-white/[0.02] transition-colors">
        {/* Avatar with speaking glow */}
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 border transition-all duration-200"
          style={{
            backgroundColor: "#0F0F13",
            borderColor: isSpeaking
              ? `rgba(0,255,65,${0.3 + audioLevel * 0.5})`
              : "rgba(0,255,65,0.15)",
            boxShadow: isSpeaking
              ? `0 0 ${4 + audioLevel * 12}px rgba(0,255,65,${0.15 + audioLevel * 0.45})`
              : undefined,
            animation: isSpeaking ? "glow-pulse 1.5s ease-in-out infinite" : undefined,
          }}
        >
          <span className="font-mono text-[11px] text-[#F0F0F0]">
            {initial}
          </span>
        </div>

        {/* Name */}
        <div className="flex-1 min-w-0 flex items-center gap-1.5">
          <span className="text-xs text-[#F0F0F0] truncate font-['Fira_Code',monospace]">
            {name}
          </span>
          {isLocal && (
            <span className="text-[9px] px-1.5 py-px rounded-full bg-[#B44DFF]/15 text-[#B44DFF] font-['Share_Tech_Mono',monospace] flex-shrink-0">
              You
            </span>
          )}
        </div>

        {/* Status indicators */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span
            className="w-2 h-2 rounded-full transition-colors duration-200"
            style={{
              backgroundColor: isMicOn ? "#00FF41" : "#FF4444",
              boxShadow: isMicOn
                ? "0 0 4px rgba(0,255,65,0.4)"
                : "0 0 2px rgba(255,68,68,0.3)",
            }}
            title={isMicOn ? "Mic on" : "Mic off"}
          />
          <span
            className="w-2 h-2 rounded-full transition-colors duration-200"
            style={{
              backgroundColor: isCameraOn ? "#00FF41" : "#FF4444",
              boxShadow: isCameraOn
                ? "0 0 4px rgba(0,255,65,0.4)"
                : "0 0 2px rgba(255,68,68,0.3)",
            }}
            title={isCameraOn ? "Camera on" : "Camera off"}
          />
          <span
            className="w-2 h-2 rounded-full transition-colors duration-200"
            style={{
              backgroundColor: isScreenOn ? "#00F0FF" : "#A0A0B0",
              boxShadow: isScreenOn
                ? "0 0 4px rgba(0,240,255,0.4)"
                : undefined,
            }}
            title={isScreenOn ? "Screen sharing" : "Not sharing"}
          />
        </div>
      </div>

      {/* Stats row */}
      {hasStats && (
        <div className="flex items-center gap-2 px-3 pb-1.5 ml-10">
          {isMicOn && trackStats.audioBitrate !== null && (
            <span className="text-[8px] text-[#00F0FF] font-['Share_Tech_Mono',monospace] bg-[#00F0FF]/10 px-1 py-0.5 rounded">
              {formatBitrate(trackStats.audioBitrate)}
            </span>
          )}
          {isCameraOn && trackStats.videoBitrate !== null && (
            <span className="text-[8px] text-[#00FF41] font-['Share_Tech_Mono',monospace] bg-[#00FF41]/10 px-1 py-0.5 rounded">
              {formatResolution(trackStats.videoWidth, trackStats.videoHeight)}
              {trackStats.videoFps !== null ? formatFps(trackStats.videoFps) : ""}
              {" "}{formatBitrate(trackStats.videoBitrate)}
            </span>
          )}
          {isScreenOn && trackStats.screenShareBitrate !== null && (
            <span className="text-[8px] text-[#00F0FF] font-['Share_Tech_Mono',monospace] bg-[#00F0FF]/10 px-1 py-0.5 rounded">
              {formatBitrate(trackStats.screenShareBitrate)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
```

**Step 2c:** Since `ParticipantRow` is now wrapped in a `<div>` instead of being a single element, the parent `.flex` in the list area (line 148-154) needs no change — the fragment around the rows will handle nested divs fine. But the existing code (lines 148-154 in the list) iterates `sorted.map()` — verify it still works. The key is still on the outer wrapper `<div>`.

Wait — the old code's outer element was the flex row itself. Now it's wrapped in a `<div>`. The key needs to be on the wrapper. Update the map in the original `ParticipantList` body (around line 148):

No change needed actually — the key is on the `ParticipantRow` component, which now returns a `<div>` wrapper. React Fragment is not used, so the key applies to the wrapper div. This is fine.

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors. May need to add type assertions for the RTCStatsReport iteration since browser types can be loose.

- [ ] **Step 4: Commit**

```bash
git add lib/hooks/useTrackStats.ts components/space/ParticipantList.tsx
git commit -m "feat: realtime per-participant upload quality stats in creative space sidebar"
```

---

## TypeScript Verification (Pre-Merge)

After all three branches are merged, run:

```bash
npx tsc --noEmit
```

Fix any issues before proceeding to review.
