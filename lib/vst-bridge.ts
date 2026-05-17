import { useVstStore, MeterLevels, VstAudioSettings } from "@/lib/store/vst";

export interface VstHandshake {
  projectId: string;
  userId: string;
  username: string;
}

export interface AudioPacket {
  seq: number;
  timestamp: number;
  sampleRate: number;
  channels: number;
  frameSize: number;
  data: Uint8Array;
}

export type AudioPacketCallback = (packet: AudioPacket) => void;
export type StateChangeCallback = () => void;
export type MeterCallback = (levels: MeterLevels) => void;
export type SettingsCallback = (settings: VstAudioSettings) => void;

const DEFAULT_PORT = 9420;
const MAX_RECONNECT_DELAY = 30000;

export class VstBridge {
  private ws: WebSocket | null = null;
  private port: number;
  private handshake: VstHandshake | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1000;
  private intentionalClose = false;

  private audioCallback: AudioPacketCallback | null = null;
  private meterCallback: MeterCallback | null = null;
  private settingsCallback: SettingsCallback | null = null;

  constructor(port: number = DEFAULT_PORT) {
    this.port = port;
  }

  connect(handshake: VstHandshake) {
    this.handshake = handshake;
    this.intentionalClose = false;
    this.reconnectDelay = 1000;
    this.clearReconnectTimer();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.doConnect();
  }

  disconnect() {
    this.intentionalClose = true;
    this.clearReconnectTimer();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    useVstStore.getState().reset();
  }

  onAudioPacket(cb: AudioPacketCallback) {
    this.audioCallback = cb;
  }

  onMeterUpdate(cb: MeterCallback) {
    this.meterCallback = cb;
  }

  onSettingsUpdate(cb: SettingsCallback) {
    this.settingsCallback = cb;
  }

  sendBitrateChange(opusBitrate: number) {
    this.send({ type: "set_settings", opusBitrate });
  }

  requestSettings() {
    this.send({ type: "get_settings" });
  }

  private doConnect() {
    const store = useVstStore.getState();
    store.setStatus("connecting");
    store.setError(null);

    const url = `ws://localhost:${this.port}`;
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      store.setStatus("error");
      store.setError("Failed to create WebSocket");
      this.scheduleReconnect();
      return;
    }

    this.ws = ws;

    ws.onopen = () => {
      this.reconnectDelay = 1000;
      if (this.handshake) {
        this.send({ type: "handshake", ...this.handshake });
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        this.handleMessage(msg);
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      if (!this.intentionalClose) {
        const currentStatus = useVstStore.getState().status;
        if (currentStatus !== "error") {
          useVstStore.getState().setStatus("disconnected");
        }
        this.scheduleReconnect();
      }
    };

    ws.onerror = () => {
      store.setStatus("error");
      store.setError("WebSocket connection error");
      ws.close();
    };
  }

  private handleMessage(msg: Record<string, unknown>) {
    const store = useVstStore.getState();

    switch (msg.type) {
      case "status":
        store.setStatus("connected");
        store.setPluginInfo({
          name: (msg.pluginName as string) ?? "Unknown",
          version: (msg.version as string) ?? "0.0.0",
        });
        // Request settings after handshake completes
        this.requestSettings();
        break;

      case "audio": {
        const raw = (msg.data as string) ?? "";
        const binary = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
        const packet: AudioPacket = {
          seq: (msg.seq as number) ?? 0,
          timestamp: (msg.timestamp as number) ?? Date.now(),
          sampleRate: (msg.sampleRate as number) ?? 48000,
          channels: (msg.channels as number) ?? 2,
          frameSize: (msg.frameSize as number) ?? 960,
          data: binary,
        };
        this.audioCallback?.(packet);
        break;
      }

      case "meter":
        this.meterCallback?.({
          left: (msg.left as number) ?? -Infinity,
          right: (msg.right as number) ?? -Infinity,
          peak: (msg.peak as number) ?? -Infinity,
        });
        store.setMeterLevels({
          left: (msg.left as number) ?? -Infinity,
          right: (msg.right as number) ?? -Infinity,
          peak: (msg.peak as number) ?? -Infinity,
        });
        break;

      case "settings":
        store.setAudioSettings({
          sampleRate: (msg.sampleRate as number) ?? 48000,
          bufferSize: (msg.bufferSize as number) ?? 256,
          channels: (msg.channels as number) ?? 2,
          opusBitrate: (msg.opusBitrate as number) ?? 128000,
        });
        this.settingsCallback?.({
          sampleRate: (msg.sampleRate as number) ?? 48000,
          bufferSize: (msg.bufferSize as number) ?? 256,
          channels: (msg.channels as number) ?? 2,
          opusBitrate: (msg.opusBitrate as number) ?? 128000,
        });
        break;

      case "error":
        store.setError((msg.message as string) ?? "Unknown error");
        break;

      case "ping":
        this.send({ type: "pong", timestamp: msg.timestamp });
        break;
    }
  }

  private send(data: Record<string, unknown>) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private scheduleReconnect() {
    if (this.intentionalClose) return;
    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => {
      this.reconnectDelay = Math.min(
        this.reconnectDelay * 2,
        MAX_RECONNECT_DELAY,
      );
      this.doConnect();
    }, this.reconnectDelay);
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}
