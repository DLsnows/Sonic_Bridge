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
const DEFAULT_CAMERA_BITRATE = 2_000_000;
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

  setAudioBitrate: (bitrate) =>
    set((s) => ({ audioQuality: { ...s.audioQuality, bitrate } })),
  setSendBufferMs: (ms) =>
    set((s) => ({ audioQuality: { ...s.audioQuality, sendBufferMs: ms } })),
  setReceiveBufferMs: (ms) =>
    set((s) => ({ audioQuality: { ...s.audioQuality, receiveBufferMs: ms } })),
  setNoiseMode: (noiseMode) =>
    set((s) => ({ audioQuality: { ...s.audioQuality, noiseMode } })),
  setCameraFps: (frameRate) =>
    set((s) => ({ camera: { ...s.camera, frameRate } })),
  setCameraResolution: (resolution) =>
    set((s) => ({ camera: { ...s.camera, resolution } })),
  setCameraBitrate: (bitrate) =>
    set((s) => ({ camera: { ...s.camera, bitrate } })),
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
