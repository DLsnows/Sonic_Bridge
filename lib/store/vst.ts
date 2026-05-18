import { create } from "zustand";

export type VstConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

export interface MeterLevels {
  left: number;
  right: number;
  peak: number;
}

export interface VstAudioSettings {
  sampleRate: number;
  bufferSize: number;
  channels: number;
  opusBitrate: number;
}

interface VstState {
  status: VstConnectionStatus;
  pluginName: string | null;
  version: string | null;
  sampleRate: number | null;
  bufferSize: number | null;
  channels: number | null;
  opusBitrate: number | null;
  meterLeft: number;
  meterRight: number;
  meterPeak: number;
  lastError: string | null;
  audioTrackPublished: boolean;
  broadcastEnabled: boolean;
  triggerReconnect: number;

  setStatus: (status: VstConnectionStatus) => void;
  setPluginInfo: (info: { name: string; version: string }) => void;
  setMeterLevels: (levels: MeterLevels) => void;
  setAudioSettings: (settings: VstAudioSettings) => void;
  setAudioTrackPublished: (published: boolean) => void;
  setBroadcastEnabled: (enabled: boolean) => void;
  setError: (error: string | null) => void;
  requestReconnect: () => void;
  reset: () => void;
}

const initialState = {
  status: "disconnected" as VstConnectionStatus,
  pluginName: null,
  version: null,
  sampleRate: null,
  bufferSize: null,
  channels: null,
  opusBitrate: null,
  meterLeft: -Infinity,
  meterRight: -Infinity,
  meterPeak: -Infinity,
  lastError: null,
  audioTrackPublished: false,
  broadcastEnabled: true,
  triggerReconnect: 0,
};

export const useVstStore = create<VstState>((set) => ({
  ...initialState,

  setStatus: (status) => set({ status }),
  setPluginInfo: (info) =>
    set({ pluginName: info.name, version: info.version }),
  setMeterLevels: (levels) =>
    set({
      meterLeft: levels.left,
      meterRight: levels.right,
      meterPeak: levels.peak,
    }),
  setAudioSettings: (settings) =>
    set({
      sampleRate: settings.sampleRate,
      bufferSize: settings.bufferSize,
      channels: settings.channels,
      opusBitrate: settings.opusBitrate,
    }),
  setAudioTrackPublished: (published) => set({ audioTrackPublished: published }),
  setBroadcastEnabled: (enabled) => set({ broadcastEnabled: enabled }),
  setError: (error) => set({ lastError: error }),
  requestReconnect: () => set((s) => ({ triggerReconnect: s.triggerReconnect + 1 })),
  reset: () => set(initialState),
}));
