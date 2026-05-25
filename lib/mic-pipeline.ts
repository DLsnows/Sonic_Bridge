import { useVstStore } from "@/lib/store/vst";

interface MicPipelineOptions {
  noiseSuppression?: boolean;
  voiceIsolation?: boolean;
  echoCancellation?: boolean;
}

export class MicPipeline {
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private destination: MediaStreamAudioDestinationNode | null = null;
  private stream: MediaStream | null = null;
  private meterRafId: number | null = null;
  private _processedTrack: MediaStreamTrack | null = null;
  private _isRunning = false;
  private meterDataArray: Uint8Array<ArrayBuffer> | null = null;
  private meterSmoothingFactor = 0.3;
  private sourceTrack: MediaStreamTrack | null = null;
  private contextStateUnsub: (() => void) | null = null;
  private trackEventUnsubs: Array<() => void> = [];

  get processedTrack(): MediaStreamTrack | null { return this._processedTrack; }
  get isRunning(): boolean { return this._isRunning; }

  async start(opts: MicPipelineOptions = {}): Promise<MediaStreamTrack> {
    if (this._isRunning) {
      this.stop();
    }

    const constraints: MediaStreamConstraints = {
      audio: {
        echoCancellation: opts.echoCancellation ?? true,
        noiseSuppression: opts.noiseSuppression ?? true,
        autoGainControl: false,
      },
    };
    const audioConstraints = constraints.audio as Record<string, unknown>;
    if (opts.voiceIsolation) audioConstraints.voiceIsolation = true;

    this.stream = await navigator.mediaDevices.getUserMedia(constraints);

    this.audioContext = new AudioContext();
    await this.audioContext.resume();
    const sourceTrack = this.stream.getAudioTracks()[0];
    this.sourceNode = this.audioContext.createMediaStreamSource(
      new MediaStream([sourceTrack]),
    );

    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = useVstStore.getState().micVolume;

    this.analyserNode = this.audioContext.createAnalyser();
    this.analyserNode.fftSize = 256;
    this.analyserNode.smoothingTimeConstant = 0.4;
    this.meterDataArray = new Uint8Array(new ArrayBuffer(this.analyserNode.fftSize));

    this.destination = this.audioContext.createMediaStreamDestination();

    this.sourceNode.connect(this.gainNode);
    this.gainNode.connect(this.analyserNode);
    this.analyserNode.connect(this.destination);

    this._processedTrack = this.destination.stream.getAudioTracks()[0];
    this._isRunning = true;
    this.startMeterLoop();

    // Auto-resume if browser suspends the context (e.g., due to a competing AudioContext).
    const ctx = this.audioContext!;
    const onStateChange = () => {
      // eslint-disable-next-line no-console
      console.warn("[mic-pipeline] AudioContext state:", ctx.state);
      if (ctx.state === "suspended" && this._isRunning) {
        ctx.resume().catch(() => {});
      }
    };
    ctx.addEventListener("statechange", onStateChange);
    this.contextStateUnsub = () => ctx.removeEventListener("statechange", onStateChange);

    // Watch the underlying capture track for browser-driven mute / end.
    this.sourceTrack = sourceTrack;
    const onMute = () => {
      // eslint-disable-next-line no-console
      console.warn("[mic-pipeline] source track MUTED");
    };
    const onUnmute = () => {
      // eslint-disable-next-line no-console
      console.warn("[mic-pipeline] source track UNMUTED");
    };
    const onEnded = () => {
      // eslint-disable-next-line no-console
      console.error("[mic-pipeline] source track ENDED — pipeline broken");
    };
    sourceTrack.addEventListener("mute", onMute);
    sourceTrack.addEventListener("unmute", onUnmute);
    sourceTrack.addEventListener("ended", onEnded);
    this.trackEventUnsubs.push(
      () => sourceTrack.removeEventListener("mute", onMute),
      () => sourceTrack.removeEventListener("unmute", onUnmute),
      () => sourceTrack.removeEventListener("ended", onEnded),
    );

    return this._processedTrack;
  }

  setVolume(volume: number) {
    if (this.gainNode && this.audioContext) {
      const clamped = Math.max(0, Math.min(2, volume));
      this.gainNode.gain.linearRampToValueAtTime(
        clamped,
        this.audioContext.currentTime + 0.05,
      );
    }
  }

  verifyAudioGraph(): { ok: boolean; reason?: string } {
    if (!this._isRunning) return { ok: false, reason: "not running" };
    if (!this.audioContext) return { ok: false, reason: "no audioContext" };
    if (this.audioContext.state !== "running") return { ok: false, reason: `audioContext state=${this.audioContext.state}` };
    if (!this.sourceNode || !this.gainNode || !this.destination) return { ok: false, reason: "graph nodes missing" };
    if (!this._processedTrack) return { ok: false, reason: "no processed track" };
    if (this._processedTrack.readyState !== "live") return { ok: false, reason: `processed track readyState=${this._processedTrack.readyState}` };
    if (this._processedTrack.muted) return { ok: false, reason: "processed track muted" };
    if (this.sourceTrack && this.sourceTrack.readyState !== "live") return { ok: false, reason: `source track readyState=${this.sourceTrack.readyState}` };
    if (this.sourceTrack?.muted) return { ok: false, reason: "source track muted" };
    return { ok: true };
  }

  stop() {
    this.stopMeterLoop();
    this.sourceNode?.disconnect();
    this.gainNode?.disconnect();
    this.analyserNode?.disconnect();
    this.sourceNode = null;
    this.gainNode = null;
    this.analyserNode = null;
    this.destination = null;
    this.meterDataArray = null;
    this._processedTrack = null;
    this._isRunning = false;
    this.contextStateUnsub?.();
    this.contextStateUnsub = null;
    for (const fn of this.trackEventUnsubs) fn();
    this.trackEventUnsubs = [];
    this.sourceTrack = null;
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
        if (this.audioContext) {
      const ctx = this.audioContext;
      ctx.close();
      this.audioContext = null;
    }
    useVstStore.getState().setMicMeterLevel(0);
  }

  private startMeterLoop() {
    if (!this.analyserNode || !this.meterDataArray) return;
    let smoothedLevel = 0;

    const poll = () => {
      if (!this.analyserNode || !this.meterDataArray) return;
      this.analyserNode.getByteTimeDomainData(this.meterDataArray);

      let sumSquares = 0;
      for (let i = 0; i < this.meterDataArray.length; i++) {
        const normalized = (this.meterDataArray[i] - 128) / 128;
        sumSquares += normalized * normalized;
      }
      const rms = Math.sqrt(sumSquares / this.meterDataArray.length);
      smoothedLevel =
        this.meterSmoothingFactor * rms +
        (1 - this.meterSmoothingFactor) * smoothedLevel;

      useVstStore.getState().setMicMeterLevel(smoothedLevel);
      this.meterRafId = requestAnimationFrame(poll);
    };

    this.meterRafId = requestAnimationFrame(poll);
  }

  private stopMeterLoop() {
    if (this.meterRafId !== null) {
      cancelAnimationFrame(this.meterRafId);
      this.meterRafId = null;
    }
  }
}

let instance: MicPipeline | null = null;

export function getMicPipeline(): MicPipeline {
  if (!instance) instance = new MicPipeline();
  return instance;
}


