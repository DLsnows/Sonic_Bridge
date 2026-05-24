import { create } from "zustand";

export type AudioBitrateKbps = number; // 192–640 kbps
export type BufferMs = number; // 8–2048ms, step 8ms
export type ScreenFps = 15 | 30 | 60;
export type ScreenResolution = "720p" | "1080p" | "original";

interface AudioQualitySettings {
  bitrate: number; // bps, 192000–640000
  sendBufferMs: BufferMs;
  receiveBufferMs: BufferMs;
  noiseSuppression: boolean;
  voiceIsolation: boolean;
}

interface ScreenShareSettings {
  frameRate: ScreenFps;
  resolution: ScreenResolution;
  bitrate: number; // bps, max 5_000_000
}

interface MediaSettingsState {
  audioQuality: AudioQualitySettings;
  screenShare: ScreenShareSettings;

  setAudioBitrate: (bitrate: number) => void;
  setSendBufferMs: (ms: BufferMs) => void;
  setReceiveBufferMs: (ms: BufferMs) => void;
  setNoiseSuppression: (enabled: boolean) => void;
  setVoiceIsolation: (enabled: boolean) => void;
  setScreenFps: (fps: ScreenFps) => void;
  setScreenResolution: (res: ScreenResolution) => void;
  setScreenBitrate: (bitrate: number) => void;
}

const DEFAULT_AUDIO_BITRATE = 256000; // 256 kbps
const DEFAULT_SEND_BUFFER_MS = 16;
const DEFAULT_RECEIVE_BUFFER_MS = 32;
const DEFAULT_SCREEN_FPS: ScreenFps = 30;
const DEFAULT_SCREEN_RESOLUTION: ScreenResolution = "1080p";
const DEFAULT_SCREEN_BITRATE = 2_500_000; // 2.5 Mbps

export const useMediaSettingsStore = create<MediaSettingsState>((set) => ({
  audioQuality: {
    bitrate: DEFAULT_AUDIO_BITRATE,
    sendBufferMs: DEFAULT_SEND_BUFFER_MS,
    receiveBufferMs: DEFAULT_RECEIVE_BUFFER_MS,
    noiseSuppression: true,
    voiceIsolation: false,
  },
  screenShare: {
    frameRate: DEFAULT_SCREEN_FPS,
    resolution: DEFAULT_SCREEN_RESOLUTION,
    bitrate: DEFAULT_SCREEN_BITRATE,
  },

  setAudioBitrate: (bitrate) =>
    set((s) => ({ audioQuality: { ...s.audioQuality, bitrate } })),
  setSendBufferMs: (ms) =>
    set((s) => ({ audioQuality: { ...s.audioQuality, sendBufferMs: ms } })),
  setReceiveBufferMs: (ms) =>
    set((s) => ({ audioQuality: { ...s.audioQuality, receiveBufferMs: ms } })),
  setNoiseSuppression: (enabled) =>
    set((s) => ({ audioQuality: { ...s.audioQuality, noiseSuppression: enabled } })),
  setVoiceIsolation: (enabled) =>
    set((s) => ({ audioQuality: { ...s.audioQuality, voiceIsolation: enabled } })),
  setScreenFps: (frameRate) =>
    set((s) => ({ screenShare: { ...s.screenShare, frameRate } })),
  setScreenResolution: (resolution) =>
    set((s) => ({ screenShare: { ...s.screenShare, resolution } })),
  setScreenBitrate: (bitrate) =>
    set((s) => ({ screenShare: { ...s.screenShare, bitrate } })),
}));

export function msToSamples(ms: number, sampleRate: number = 48000): number {
  return Math.round((ms / 1000) * sampleRate);
}
