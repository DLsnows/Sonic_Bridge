import { useVstStore, MeterLevels } from "@/lib/store/vst";

export interface VstHandshake {
  projectId: string;
  userId: string;
  username: string;
}

export type PcmDataCallback = (
  interleaved: Float32Array,
  sampleRate: number,
  channels: number,
  numSamples: number
) => void;

export type MeterCallback = (levels: MeterLevels) => void;

const MAX_RECONNECT_DELAY = 30000;

export class VstBridge {
  private ws: WebSocket | null = null;
  private port: number;
  private handshake: VstHandshake | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1000;
  private intentionalClose = false;

  private pcmCallback: PcmDataCallback | null = null;
  private meterCallback: MeterCallback | null = null;

  constructor(port?: number) {
    this.port = port ?? useVstStore.getState().preferredPort;
  }

  setPort(port: number) {
    this.port = port;
    useVstStore.getState().setPreferredPort(port);
  }

  getPort(): number {
    return this.port;
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

  onPcmData(cb: PcmDataCallback) {
    this.pcmCallback = cb;
  }

  onMeterUpdate(cb: MeterCallback) {
    this.meterCallback = cb;
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

    // Accept binary frames
    ws.binaryType = "arraybuffer";
    this.ws = ws;

    ws.onopen = () => {
      this.reconnectDelay = 1000;
      if (this.handshake) {
        this.send({ type: "handshake", ...this.handshake });
      }
    };

    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        this.handleBinaryFrame(event.data);
      } else {
        try {
          const msg = JSON.parse(event.data as string);
          this.handleJsonMessage(msg);
        } catch {
          // ignore malformed messages
        }
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

  private handleBinaryFrame(data: ArrayBuffer) {
    if (data.byteLength < 12) return; // minimum header size

    const header = new DataView(data);
    const sampleRate = header.getUint32(0, true);
    const channels = header.getUint32(4, true);
    const numSamples = header.getUint32(8, true);

    // Validate frame bounds (real-world DAW constraints)
    if (numSamples === 0 || numSamples > 16384) return;
    if (channels === 0 || channels > 16) return;

    const expectedBytes = 12 + numSamples * channels * 4;
    if (data.byteLength < expectedBytes) return;

    const pcmData = new Float32Array(data, 12, numSamples * channels);
    this.pcmCallback?.(pcmData, sampleRate, channels, numSamples);
  }

  private handleJsonMessage(msg: Record<string, unknown>) {
    const store = useVstStore.getState();

    switch (msg.type) {
      case "status":
        store.setStatus("connected");
        store.setPluginInfo({
          name: (msg.pluginName as string) ?? "Unknown",
          version: (msg.version as string) ?? "0.0.0",
        });
        this.requestSettings();
        break;

      case "meter": {
        const levels = {
          left: (msg.left as number) ?? -Infinity,
          right: (msg.right as number) ?? -Infinity,
          peak: (msg.peak as number) ?? -Infinity,
        };
        store.setMeterLevels(levels);
        this.meterCallback?.(levels);
        break;
      }

      case "settings": {
        store.setAudioSettings({
          sampleRate: (msg.sampleRate as number) ?? 48000,
          bufferSize: (msg.bufferSize as number) ?? 256,
          channels: (msg.channels as number) ?? 2,
          opusBitrate: (msg.opusBitrate as number) ?? 128000,
        });
        break;
      }

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
