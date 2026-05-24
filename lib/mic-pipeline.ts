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

  get processedTrack(): MediaStreamTrack | null { return this._processedTrack; }
  get isRunning(): boolean { return this._isRunning; }

  async start(opts: MicPipelineOptions = {}): Promise<MediaStreamTrack> {
    if (this._isRunning) return this._processedTrack!;

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
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.audioContext?.close();
    this.audioContext = null;
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
