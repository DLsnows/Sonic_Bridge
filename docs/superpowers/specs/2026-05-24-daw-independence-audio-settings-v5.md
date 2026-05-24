# Creative Space — DAW Independence + Audio Settings v5

**Date:** 2026-05-24
**Status:** In design

## Root Causes

1. **DAW audio shares mic channel** — `VstAudioBridge.tsx` publishes DAW audio as `Track.Source.Microphone`, making it inseparable from mic
2. **Broadcast toggle non-functional** — `broadcastEnabled` in VstStore is never read by VstAudioBridge
3. **Audio bitrate not applied** — `audioBitrate` exists in LiveKit protocol but not in client TS types; must pass as custom publish option
4. **Send/Receive buffers not applied** — Values stored but pipeline calls missing
5. **Stats rendering broken** — Missing screen share resolution/FPS and audio bitrate

## Part 1: DAW Independent Audio Channel

### Change `VstAudioBridge.tsx`

```ts
// Publish DAW audio as independent source — not Microphone
participantRef.current.publishTrack(track, {
  name: "DAW Audio (VST)",
  source: Track.Source.Unknown,
  audioBitrate: useMediaSettingsStore.getState().dawAudio.bitrate,
});
```

### Read `broadcastEnabled`

```ts
const broadcastEnabled = useVstStore((s) => s.broadcastEnabled);

// Only publish when broadcast is enabled
if (broadcastEnabled && !published) { publishTrack(...) }
// Unpublish when broadcast is disabled
if (!broadcastEnabled && published) { unpublishTrack(...) }
```

### ControlBar — unpublish only mic

```ts
// Unpublish only Source.Microphone — DAW audio stays
const pub = localParticipant.getTrackPublication(Track.Source.Microphone);
if (pub) await localParticipant.unpublishTrack(pub.track!);
```

## Part 2: Audio Bitrate Control

### Mic bitrate (MediaSettings → actually applied)

In `handleToggleMic`, pass `audioBitrate` when publishing:

```ts
const { bitrate } = useMediaSettingsStore.getState().audioQuality;
await localParticipant.publishTrack(track, {
  source: Track.Source.Microphone,
  audioBitrate: bitrate,  // 192000–510000
});
```

Update store defaults: `DEFAULT_AUDIO_BITRATE` range to 192000–510000.

### DAW bitrate (AudioMixer → actually applied)

New store field: `dawAudio.bitrate` (192000–510000, default 256000).

In `VstAudioBridge`, pass `audioBitrate` when publishing DAW track.

### Camera/Screen bitrate

Already passed via `videoEncoding: { maxBitrate }` in `handleToggleCamera` / `handleToggleScreenShare`. Verify correct.

## Part 3: Buffer Application

### Send Buffer (DAW)

In `VstAudioBridge`, on PCM data callback:
```ts
const sendBufferMs = useMediaSettingsStore.getState().audioQuality.sendBufferMs;
pipeline.setSendBufferSize(msToSamples(sendBufferMs));
```

### Receive Buffer (all audio)

In `VstAudioBridge`, on init:
```ts
const receiveBufferMs = useMediaSettingsStore.getState().audioQuality.receiveBufferMs;
pipeline.setReceiveBufferSize(msToSamples(receiveBufferMs));
```

## Part 4: Stats Display Fix

Fix `ParticipantList.tsx` — ensure all three stat badges render:
- Audio bitrate (mic on)
- Video resolution+fps+bitrate (camera on)
- Screen share resolution+fps+bitrate (screen on)

Fix `useTrackStats.ts` — ensure `screenShareWidth/Height/Fps` fields populated.

## Part 5: Noise Cancellation Verification

- Mic: `getUserMedia({ noiseSuppression: true })` in `MicPipeline.start()` ✅
- DAW: `publishTrack()` bypasses getUserMedia, no noise processing ✅

## Part 6: AudioMixer Cleanup

- Remove "Opus Bitrate" slider (moved to MediaSettings → Microphone section)
- Add "DAW Bitrate" slider (64–510 kbps)
- Add "DAW Send Buffer" slider (label renamed)
- Move "Receive Buffer" to Outputs section (applies to all audio)

## Store Changes

```ts
// New
interface DawAudioSettings {
  bitrate: number;  // 192000–510000, default 256000
}

interface MediaSettingsState {
  audioQuality: AudioQualitySettings;
  camera: CameraSettings;
  screenShare: ScreenShareSettings;
  dawAudio: DawAudioSettings;  // NEW
  // ...setters
}

// AudioQualitySettings: bitrate range 192000–510000 (was 640000)
```

## Files Changed

| File | Summary |
|------|---------|
| `components/space/VstAudioBridge.tsx` | Source.Unknown, broadcast control, audioBitrate, buffer application |
| `components/space/VstConnectionPanel.tsx` | Broadcast toggle already exists — verify it works |
| `components/space/ControlBar.tsx` | Unpublish only Source.Microphone, pass audioBitrate |
| `components/space/AudioMixer.tsx` | Remove Opus bitrate, add DAW bitrate + buffer |
| `components/space/MediaSettingsPanel.tsx` | Mic bitrate slider max 510kbps |
| `components/space/ParticipantList.tsx` | Fix stats rendering |
| `lib/hooks/useTrackStats.ts` | Fix screen share stats collection |
| `lib/store/media-settings.ts` | DawAudioSettings, bitrate range 192–510k |
| `lib/store/vst.ts` | broadcastEnabled already exists |
| `lib/mic-pipeline.ts` | Pass audioBitrate on publish |
