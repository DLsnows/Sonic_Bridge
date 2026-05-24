# Creative Space UX Fixes v3 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign MediaSettings panel (3 sections), fix mic by never passing voiceIsolation:false, add camera quality settings, enhance screen share stats display.

**Architecture:** Task 1 updates the Zustand store (shared dependency). Tasks 2-3 run in parallel on separate branches. All merge to `fix/creative-space-v3` then reviewed before any dev merge.

**Tech Stack:** Next.js 16, React 19, LiveKit Client/Components, Zustand, TypeScript

---

## File Map

| Task | Branch | Files |
|------|--------|-------|
| 1 | `fix/v3-store` | `lib/store/media-settings.ts` |
| 2 | `fix/v3-mic` | `CreativeSpaceRoom.tsx`, `ControlBar.tsx` (mic part), `AudioMixer.tsx`, `mic-processor.ts` |
| 3 | `fix/v3-camera-screen` | `MediaSettingsPanel.tsx`, `ControlBar.tsx` (camera part), `ParticipantList.tsx` |

Task 1 must finish first. Tasks 2-3 can then run in parallel.

---

### Task 1: Update Media Settings Store

**Files:**
- Modify: `lib/store/media-settings.ts`

**Step 1: Add types and rewrite store**

Replace the entire file:

```ts
import { create } from "zustand";

export type AudioBitrateKbps = number;
export type BufferMs = number;
export type VideoFps = 15 | 30 | 60;
export type VideoResolution = "720p" | "1080p";
export type ScreenResolution = "720p" | "1080p" | "original";
export type NoiseMode = "off" | "suppression" | "voiceIsolation";

interface AudioQualitySettings {
  bitrate: number;
  sendBufferMs: BufferMs;
  receiveBufferMs: BufferMs;
  noiseMode: NoiseMode;
}

interface CameraSettings {
  frameRate: VideoFps;
  resolution: VideoResolution;
  bitrate: number;
}

interface ScreenShareSettings {
  frameRate: VideoFps;
  resolution: ScreenResolution;
  bitrate: number;
}

interface MediaSettingsState {
  audioQuality: AudioQualitySettings;
  camera: CameraSettings;
  screenShare: ScreenShareSettings;

  setAudioBitrate: (bitrate: number) => void;
  setSendBufferMs: (ms: BufferMs) => void;
  setReceiveBufferMs: (ms: BufferMs) => void;
  setNoiseMode: (mode: NoiseMode) => void;
  setCameraFps: (fps: VideoFps) => void;
  setCameraResolution: (res: VideoResolution) => void;
  setCameraBitrate: (bitrate: number) => void;
  setScreenFps: (fps: VideoFps) => void;
  setScreenResolution: (res: ScreenResolution) => void;
  setScreenBitrate: (bitrate: number) => void;
}

const DEFAULT_AUDIO_BITRATE = 256000;
const DEFAULT_SEND_BUFFER_MS = 16;
const DEFAULT_RECEIVE_BUFFER_MS = 32;
const DEFAULT_CAMERA_FPS: VideoFps = 30;
const DEFAULT_CAMERA_RESOLUTION: VideoResolution = "1080p";
const DEFAULT_CAMERA_BITRATE = 3_000_000;
const DEFAULT_SCREEN_FPS: VideoFps = 30;
const DEFAULT_SCREEN_RESOLUTION: ScreenResolution = "1080p";
const DEFAULT_SCREEN_BITRATE = 2_500_000;

export const useMediaSettingsStore = create<MediaSettingsState>((set) => ({
  audioQuality: {
    bitrate: DEFAULT_AUDIO_BITRATE,
    sendBufferMs: DEFAULT_SEND_BUFFER_MS,
    receiveBufferMs: DEFAULT_RECEIVE_BUFFER_MS,
    noiseMode: "suppression",
  },
  camera: {
    frameRate: DEFAULT_CAMERA_FPS,
    resolution: DEFAULT_CAMERA_RESOLUTION,
    bitrate: DEFAULT_CAMERA_BITRATE,
  },
  screenShare: {
    frameRate: DEFAULT_SCREEN_FPS,
    resolution: DEFAULT_SCREEN_RESOLUTION,
    bitrate: DEFAULT_SCREEN_BITRATE,
  },

  setAudioBitrate: (bitrate) => set((s) => ({ audioQuality: { ...s.audioQuality, bitrate } })),
  setSendBufferMs: (ms) => set((s) => ({ audioQuality: { ...s.audioQuality, sendBufferMs: ms } })),
  setReceiveBufferMs: (ms) => set((s) => ({ audioQuality: { ...s.audioQuality, receiveBufferMs: ms } })),
  setNoiseMode: (noiseMode) => set((s) => ({ audioQuality: { ...s.audioQuality, noiseMode } })),
  setCameraFps: (frameRate) => set((s) => ({ camera: { ...s.camera, frameRate } })),
  setCameraResolution: (resolution) => set((s) => ({ camera: { ...s.camera, resolution } })),
  setCameraBitrate: (bitrate) => set((s) => ({ camera: { ...s.camera, bitrate } })),
  setScreenFps: (frameRate) => set((s) => ({ screenShare: { ...s.screenShare, frameRate } })),
  setScreenResolution: (resolution) => set((s) => ({ screenShare: { ...s.screenShare, resolution } })),
  setScreenBitrate: (bitrate) => set((s) => ({ screenShare: { ...s.screenShare, bitrate } })),
}));

export function msToSamples(ms: number, sampleRate: number = 48000): number {
  return Math.round((ms / 1000) * sampleRate);
}
```

Note: `ScreenFps` and `ScreenResolution` are removed (replaced by `VideoFps` and `ScreenResolution`). Update any imports elsewhere to use the new names.

**Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Fix any TS errors in files that imported the old types.

**Step 3: Commit**

```bash
git add lib/store/media-settings.ts
git commit -m "refactor: add CameraSettings, noiseMode, unify video types in media settings store"
```

---

### Task 2: Mic Fix

**Files:**
- Modify: `components/space/CreativeSpaceRoom.tsx`
- Modify: `components/space/ControlBar.tsx` (handleToggleMic only)
- Modify: `components/space/AudioMixer.tsx` (noise toggles)
- Modify: `lib/mic-processor.ts` (getCaptureOptions)

**Step 1: Fix CreativeSpaceRoom — remove voiceIsolation:false**

In `components/space/CreativeSpaceRoom.tsx`, change the `audio` prop:

```tsx
audio={{
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: false,
  processor: getMicProcessor(),
}}
```

Remove the `voiceIsolation: false` line entirely.

**Step 2: Fix mic-processor — simplify getCaptureOptions**

In `lib/mic-processor.ts`, change `getCaptureOptions()`:

```ts
getCaptureOptions(): AudioCaptureOptions {
    return {
      processor: this,
      echoCancellation: true,
      autoGainControl: false,
    };
  }
```

Remove `noiseSuppression: true` — let the caller decide.

**Step 3: Fix ControlBar handleToggleMic — conditional constraints**

In `components/space/ControlBar.tsx`, replace `handleToggleMic`:

```tsx
async function handleToggleMic() {
    try {
      if (!isMicrophoneEnabled) {
        const { noiseMode } = useMediaSettingsStore.getState().audioQuality;
        const micOptions: AudioCaptureOptions = {
          ...getMicProcessor().getCaptureOptions(),
        };
        if (noiseMode === "suppression") micOptions.noiseSuppression = true;
        if (noiseMode === "voiceIsolation") micOptions.voiceIsolation = true;
        await localParticipant.setMicrophoneEnabled(true, micOptions);
      } else {
        await localParticipant.setMicrophoneEnabled(false);
      }
    } catch (e) { console.error("Mic toggle failed:", e); }
  }
```

Also update the mute-on-connect useEffect to use the same pattern (read noiseMode).

**Step 4: Fix AudioMixer — update noise toggles to 3-way**

In `components/space/AudioMixer.tsx`, replace the two boolean toggle buttons with a 3-way exclusive toggle.

Replace the noiseSuppression/voiceIsolation toggle section with:

```tsx
{/* Noise Reduction */}
<div className="space-y-1.5">
  <span className="text-[10px] text-[#A0A0B0] font-['Share_Tech_Mono',monospace]">
    Noise Reduction
  </span>
  <div className="flex gap-1.5">
    <button
      onClick={() => setNoiseMode("off")}
      className={`flex-1 py-1 rounded text-[9px] font-['Share_Tech_Mono',monospace] transition-colors border ${
        noiseMode === "off"
          ? "bg-white/10 text-[#F0F0F0] border-white/20"
          : "bg-white/[0.02] text-[#A0A0B0] border-white/5 hover:bg-white/5"
      }`}
    >
      Off
    </button>
    <button
      onClick={() => setNoiseMode("suppression")}
      className={`flex-1 py-1 rounded text-[9px] font-['Share_Tech_Mono',monospace] transition-colors border ${
        noiseMode === "suppression"
          ? "bg-[#00FF41]/15 text-[#00FF41] border-[#00FF41]/30"
          : "bg-white/[0.02] text-[#A0A0B0] border-white/5 hover:bg-white/5"
      }`}
    >
      Suppression
    </button>
    <button
      onClick={() => setNoiseMode("voiceIsolation")}
      className={`flex-1 py-1 rounded text-[9px] font-['Share_Tech_Mono',monospace] transition-colors border ${
        noiseMode === "voiceIsolation"
          ? "bg-[#B44DFF]/15 text-[#B44DFF] border-[#B44DFF]/30"
          : "bg-white/[0.02] text-[#A0A0B0] border-white/5 hover:bg-white/5"
      }`}
    >
      Voice Iso
    </button>
  </div>
</div>
```

Update imports: replace `noiseSuppression`/`voiceIsolation`/`setNoiseSuppression`/`setVoiceIsolation` with `noiseMode`/`setNoiseMode`:

```tsx
const noiseMode = useMediaSettingsStore((s) => s.audioQuality.noiseMode);
const setNoiseMode = useMediaSettingsStore((s) => s.setNoiseMode);
```

Update the useEffect that re-creates the mic track when noise mode changes:

```tsx
const room = useMaybeRoomContext();

useEffect(() => {
  if (!room?.localParticipant) return;
  const lp = room.localParticipant;
  if (!lp.isMicrophoneEnabled) return;
  const nm = useMediaSettingsStore.getState().audioQuality.noiseMode;
  lp.setMicrophoneEnabled(false).then(() => {
    const opts: AudioCaptureOptions = {
      echoCancellation: true,
      autoGainControl: false,
      processor: getMicProcessor(),
    };
    if (nm === "suppression") opts.noiseSuppression = true;
    if (nm === "voiceIsolation") opts.voiceIsolation = true;
    lp.setMicrophoneEnabled(true, opts);
  }).catch(() => {});
}, [noiseMode, room]);
```

**Step 5: TypeScript check + Commit**

```bash
npx tsc --noEmit
```

```bash
git add components/space/CreativeSpaceRoom.tsx components/space/ControlBar.tsx components/space/AudioMixer.tsx lib/mic-processor.ts
git commit -m "fix: only pass noise constraints when true, remove voiceIsolation:false, 3-way noise toggle"
```

---

### Task 3: MediaSettings Panel + Camera + Screen Stats

**Files:**
- Modify: `components/space/MediaSettingsPanel.tsx` (complete redesign)
- Modify: `components/space/ControlBar.tsx` (handleToggleCamera)
- Modify: `components/space/ParticipantList.tsx` (screen share stats row)

**Step 1: Redesign MediaSettingsPanel**

Rewrite `components/space/MediaSettingsPanel.tsx` with three independent sections. Full implementation:

```tsx
"use client";

import { useMediaSettingsStore, msToSamples, type VideoFps, type VideoResolution, type ScreenResolution, type NoiseMode } from "@/lib/store/media-settings";
import { Modal } from "@/components/ui/Modal";

interface MediaSettingsPanelProps { open: boolean; onClose: () => void; }

const BITRATE_STEP = 32000;
const BITRATE_MIN = 192000;
const BITRATE_MAX = 640000;
const BUFFER_MIN_MS = 8;
const BUFFER_MAX_MS = 2048;
const BUFFER_STEP_MS = 8;

const VIDEO_BITRATE_MIN = 500_000;
const VIDEO_BITRATE_MAX = 5_000_000;
const VIDEO_BITRATE_STEP = 250_000;

const FPS_OPTIONS: { label: string; value: VideoFps }[] = [
  { label: "15 fps", value: 15 },
  { label: "30 fps", value: 30 },
  { label: "60 fps", value: 60 },
];

const CAM_RES_OPTIONS: { label: string; value: VideoResolution }[] = [
  { label: "720p", value: "720p" },
  { label: "1080p", value: "1080p" },
];

const SCREEN_RES_OPTIONS: { label: string; value: ScreenResolution }[] = [
  { label: "720p", value: "720p" },
  { label: "1080p", value: "1080p" },
  { label: "Original", value: "original" },
];

const NOISE_OPTIONS: { label: string; value: NoiseMode }[] = [
  { label: "Off", value: "off" },
  { label: "Suppression", value: "suppression" },
  { label: "Voice Iso (Chrome)", value: "voiceIsolation" },
];

function bufferLabel(ms: number): string {
  return `${ms}ms (${msToSamples(ms)} smp)`;
}

function bitrateLabel(bps: number): string {
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} Mbps`;
  return `${Math.round(bps / 1000)} kbps`;
}

export function MediaSettingsPanel({ open, onClose }: MediaSettingsPanelProps) {
  const audioQuality = useMediaSettingsStore((s) => s.audioQuality);
  const camera = useMediaSettingsStore((s) => s.camera);
  const screenShare = useMediaSettingsStore((s) => s.screenShare);
  const setAudioBitrate = useMediaSettingsStore((s) => s.setAudioBitrate);
  const setSendBufferMs = useMediaSettingsStore((s) => s.setSendBufferMs);
  const setReceiveBufferMs = useMediaSettingsStore((s) => s.setReceiveBufferMs);
  const setNoiseMode = useMediaSettingsStore((s) => s.setNoiseMode);
  const setCameraFps = useMediaSettingsStore((s) => s.setCameraFps);
  const setCameraResolution = useMediaSettingsStore((s) => s.setCameraResolution);
  const setCameraBitrate = useMediaSettingsStore((s) => s.setCameraBitrate);
  const setScreenFps = useMediaSettingsStore((s) => s.setScreenFps);
  const setScreenResolution = useMediaSettingsStore((s) => s.setScreenResolution);
  const setScreenBitrate = useMediaSettingsStore((s) => s.setScreenBitrate);

  return (
    <Modal open={open} onClose={onClose} title="Media Quality Settings">
      <div className="space-y-6">
        {/* ===== Microphone ===== */}
        <section>
          <h3 className="text-xs font-['Share_Tech_Mono',monospace] text-[#00F0FF] uppercase tracking-wider mb-3">
            Microphone
          </h3>
          {/* Bitrate */}
          <div className="mb-4">
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-[#A0A0B0] font-['Share_Tech_Mono',monospace]">Opus Bitrate</span>
              <span className="text-[#F0F0F0] font-mono">{bitrateLabel(audioQuality.bitrate)}</span>
            </div>
            <input type="range" min={BITRATE_MIN} max={BITRATE_MAX} step={BITRATE_STEP} value={audioQuality.bitrate}
              onChange={(e) => setAudioBitrate(Number(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-[#00F0FF]/20 accent-[#00F0FF]
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#00F0FF] [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(0,240,255,0.5)]" />
          </div>
          {/* Send Buffer */}
          <div className="mb-4">
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-[#A0A0B0] font-['Share_Tech_Mono',monospace]">Send Buffer</span>
              <span className="text-[#F0F0F0] font-mono">{bufferLabel(audioQuality.sendBufferMs)}</span>
            </div>
            <input type="range" min={BUFFER_MIN_MS} max={BUFFER_MAX_MS} step={BUFFER_STEP_MS} value={audioQuality.sendBufferMs}
              onChange={(e) => setSendBufferMs(Number(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-[#00F0FF]/20 accent-[#00F0FF]
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#00F0FF] [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(0,240,255,0.5)]" />
          </div>
          {/* Receive Buffer */}
          <div className="mb-4">
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-[#A0A0B0] font-['Share_Tech_Mono',monospace]">Receive Buffer</span>
              <span className="text-[#F0F0F0] font-mono">{bufferLabel(audioQuality.receiveBufferMs)}</span>
            </div>
            <input type="range" min={BUFFER_MIN_MS} max={BUFFER_MAX_MS} step={BUFFER_STEP_MS} value={audioQuality.receiveBufferMs}
              onChange={(e) => setReceiveBufferMs(Number(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-[#00F0FF]/20 accent-[#00F0FF]
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#00F0FF] [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(0,240,255,0.5)]" />
          </div>
          {/* Noise Reduction */}
          <div>
            <p className="text-[10px] text-[#A0A0B0] font-['Share_Tech_Mono',monospace] mb-2">Noise Reduction</p>
            <div className="flex gap-1.5">
              {NOISE_OPTIONS.map((opt) => (
                <button key={opt.value} onClick={() => setNoiseMode(opt.value)}
                  className={`flex-1 py-1.5 rounded text-[10px] font-['Share_Tech_Mono',monospace] transition-colors border ${
                    audioQuality.noiseMode === opt.value
                      ? opt.value === "voiceIsolation"
                        ? "bg-[#B44DFF]/15 text-[#B44DFF] border-[#B44DFF]/30"
                        : opt.value === "suppression"
                        ? "bg-[#00FF41]/15 text-[#00FF41] border-[#00FF41]/30"
                        : "bg-white/10 text-[#F0F0F0] border-white/20"
                      : "bg-white/[0.02] text-[#A0A0B0] border-white/5 hover:bg-white/5"
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <div className="border-t border-[#00F0FF]/10" />

        {/* ===== Camera ===== */}
        <section>
          <h3 className="text-xs font-['Share_Tech_Mono',monospace] text-[#00F0FF] uppercase tracking-wider mb-3">Camera</h3>
          {/* Frame Rate */}
          <div className="mb-3">
            <p className="text-[10px] text-[#A0A0B0] font-['Share_Tech_Mono',monospace] mb-2">Frame Rate</p>
            <div className="flex gap-2">
              {FPS_OPTIONS.map((opt) => (
                <button key={opt.value} onClick={() => setCameraFps(opt.value)}
                  className={`flex-1 py-1.5 rounded text-[11px] font-['Share_Tech_Mono',monospace] transition-colors border ${
                    camera.frameRate === opt.value
                      ? "bg-[#00F0FF]/15 text-[#00F0FF] border-[#00F0FF]/30"
                      : "bg-white/5 text-[#A0A0B0] border-white/10 hover:bg-white/10"
                  }`}>{opt.label}</button>
              ))}
            </div>
          </div>
          {/* Resolution */}
          <div className="mb-3">
            <p className="text-[10px] text-[#A0A0B0] font-['Share_Tech_Mono',monospace] mb-2">Resolution</p>
            <div className="flex gap-2">
              {CAM_RES_OPTIONS.map((opt) => (
                <button key={opt.value} onClick={() => setCameraResolution(opt.value)}
                  className={`flex-1 py-1.5 rounded text-[11px] font-['Share_Tech_Mono',monospace] transition-colors border ${
                    camera.resolution === opt.value
                      ? "bg-[#00F0FF]/15 text-[#00F0FF] border-[#00F0FF]/30"
                      : "bg-white/5 text-[#A0A0B0] border-white/10 hover:bg-white/10"
                  }`}>{opt.label}</button>
              ))}
            </div>
          </div>
          {/* Bitrate */}
          <div>
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-[#A0A0B0] font-['Share_Tech_Mono',monospace]">Bitrate</span>
              <span className="text-[#F0F0F0] font-mono">{bitrateLabel(camera.bitrate)}</span>
            </div>
            <input type="range" min={VIDEO_BITRATE_MIN} max={VIDEO_BITRATE_MAX} step={VIDEO_BITRATE_STEP} value={camera.bitrate}
              onChange={(e) => setCameraBitrate(Number(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-[#00F0FF]/20 accent-[#00F0FF]
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#00F0FF] [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(0,240,255,0.5)]" />
            <div className="flex justify-between text-[8px] text-[#A0A0B0] mt-0.5">
              <span>0.5 Mbps</span><span>5 Mbps</span>
            </div>
          </div>
        </section>

        <div className="border-t border-[#00F0FF]/10" />

        {/* ===== Screen Share ===== */}
        <section>
          <h3 className="text-xs font-['Share_Tech_Mono',monospace] text-[#00F0FF] uppercase tracking-wider mb-3">Screen Share</h3>
          {/* Frame Rate */}
          <div className="mb-3">
            <p className="text-[10px] text-[#A0A0B0] font-['Share_Tech_Mono',monospace] mb-2">Frame Rate</p>
            <div className="flex gap-2">
              {FPS_OPTIONS.map((opt) => (
                <button key={opt.value} onClick={() => setScreenFps(opt.value)}
                  className={`flex-1 py-1.5 rounded text-[11px] font-['Share_Tech_Mono',monospace] transition-colors border ${
                    screenShare.frameRate === opt.value
                      ? "bg-[#00F0FF]/15 text-[#00F0FF] border-[#00F0FF]/30"
                      : "bg-white/5 text-[#A0A0B0] border-white/10 hover:bg-white/10"
                  }`}>{opt.label}</button>
              ))}
            </div>
          </div>
          {/* Resolution */}
          <div className="mb-3">
            <p className="text-[10px] text-[#A0A0B0] font-['Share_Tech_Mono',monospace] mb-2">Resolution</p>
            <div className="flex gap-2">
              {SCREEN_RES_OPTIONS.map((opt) => (
                <button key={opt.value} onClick={() => setScreenResolution(opt.value)}
                  className={`flex-1 py-1.5 rounded text-[11px] font-['Share_Tech_Mono',monospace] transition-colors border ${
                    screenShare.resolution === opt.value
                      ? "bg-[#00F0FF]/15 text-[#00F0FF] border-[#00F0FF]/30"
                      : "bg-white/5 text-[#A0A0B0] border-white/10 hover:bg-white/10"
                  }`}>{opt.label}</button>
              ))}
            </div>
          </div>
          {/* Bitrate */}
          <div>
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-[#A0A0B0] font-['Share_Tech_Mono',monospace]">Bitrate</span>
              <span className="text-[#F0F0F0] font-mono">{bitrateLabel(screenShare.bitrate)}</span>
            </div>
            <input type="range" min={VIDEO_BITRATE_MIN} max={VIDEO_BITRATE_MAX} step={VIDEO_BITRATE_STEP} value={screenShare.bitrate}
              onChange={(e) => setScreenBitrate(Number(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-[#00F0FF]/20 accent-[#00F0FF]
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#00F0FF] [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(0,240,255,0.5)]" />
            <div className="flex justify-between text-[8px] text-[#A0A0B0] mt-0.5">
              <span>0.5 Mbps</span><span>5 Mbps</span>
            </div>
          </div>
        </section>
      </div>
    </Modal>
  );
}
```

**Step 2: Fix ControlBar handleToggleCamera — apply camera settings**

In `components/space/ControlBar.tsx`, replace `handleToggleCamera`:

```tsx
async function handleToggleCamera() {
    try {
      if (!isCameraEnabled) {
        const cam = useMediaSettingsStore.getState().camera;
        const w = cam.resolution === "720p" ? 1280 : 1920;
        const h = cam.resolution === "720p" ? 720 : 1080;
        await localParticipant.setCameraEnabled(true, {
          resolution: { width: w, height: h, frameRate: cam.frameRate },
        }, {
          videoEncoding: { maxBitrate: cam.bitrate },
        });
      } else {
        await localParticipant.setCameraEnabled(false);
      }
    } catch { /* device access may be denied */ }
  }
```

**Step 3: Fix ParticipantList — screen share resolution + FPS**

In `components/space/ParticipantList.tsx`, update the screen share stats badge to include resolution and FPS:

Find the `{isScreenOn && ...}` stats badge and change from:

```tsx
{isScreenOn && trackStats.screenShareBitrate !== null && (
  <span className="text-[8px] text-[#00F0FF] font-['Share_Tech_Mono',monospace] bg-[#00F0FF]/10 px-1 py-0.5 rounded">
    {formatBitrate(trackStats.screenShareBitrate)}
  </span>
)}
```

To:

```tsx
{isScreenOn && trackStats.screenShareBitrate !== null && (
  <span className="text-[8px] text-[#00F0FF] font-['Share_Tech_Mono',monospace] bg-[#00F0FF]/10 px-1 py-0.5 rounded">
    {formatResolution(trackStats.videoWidth, trackStats.videoHeight)}
    {trackStats.videoFps !== null ? formatFps(trackStats.videoFps) : ""}
    {" "}{formatBitrate(trackStats.screenShareBitrate)}
  </span>
)}
```

**Step 4: Fix TS errors from renamed types**

Search for any files still importing `ScreenFps` or `ScreenResolution` and update:
- `ScreenFps` → `VideoFps` (from media-settings store)
- `ScreenResolution` → unchanged (still exists in store)

```bash
npx tsc --noEmit
```

Fix any errors.

**Step 5: Commit**

```bash
git add components/space/MediaSettingsPanel.tsx components/space/ControlBar.tsx components/space/ParticipantList.tsx
git commit -m "feat: separate camera settings, redesign media panel with 3 sections, enhance screen stats"
```

---

## Final Merge

Merge both task branches into `fix/creative-space-v3`. Run `npx tsc --noEmit`. Push for review.
