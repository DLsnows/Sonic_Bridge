import type {
  TrackProcessor,
  AudioProcessorOptions,
  AudioCaptureOptions,
} from "livekit-client";
import { Track } from "livekit-client";
import { useVstStore } from "@/lib/store/vst";

export class MicProcessor
  implements TrackProcessor<Track.Kind.Audio, AudioProcessorOptions>
{
  name = "mic-volume-processor";
  processedTrack?: MediaStreamTrack;

  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private destination: MediaStreamAudioDestinationNode | null = null;
  private meterRafId: number | null = null;
  private meterDataArray: Uint8Array<ArrayBuffer> | null = null;
  private meterSmoothingFactor = 0.3;

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
      console.error("MicProcessor init failed, using pass-through:", e);
      // Clean up any partially-created nodes
      this.sourceNode?.disconnect();
      this.analyserNode?.disconnect();
      this.gainNode?.disconnect();
      this.sourceNode = null;
      this.analyserNode = null;
      this.gainNode = null;
      this.destination = null;
      this.meterDataArray = null;
      this.processedTrack = track;
    }
  }

  async restart(opts: AudioProcessorOptions): Promise<void> {
    const { audioContext, track } = opts;

    this.stopMeterLoop();

    if (this.sourceNode) {
      this.sourceNode.disconnect();
    }

    this.sourceNode = audioContext.createMediaStreamSource(
      new MediaStream([track]),
    );

    if (this.analyserNode && this.gainNode && this.destination) {
      this.sourceNode.connect(this.analyserNode);
      this.analyserNode.connect(this.gainNode);
      this.gainNode.connect(this.destination);
      this.processedTrack = this.destination.stream.getAudioTracks()[0];
    }

    this.startMeterLoop();
  }

  async destroy(): Promise<void> {
    this.stopMeterLoop();
    this.sourceNode?.disconnect();
    this.analyserNode?.disconnect();
    this.gainNode?.disconnect();
    this.sourceNode = null;
    this.analyserNode = null;
    this.gainNode = null;
    this.destination = null;
    this.meterDataArray = null;
    this.audioContext = null;
    this.processedTrack = undefined;
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

  getCaptureOptions(): AudioCaptureOptions {
    return {
      processor: this,
      echoCancellation: true,

      autoGainControl: false,
    };
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
    useVstStore.getState().setMicMeterLevel(0);
  }
}

let instance: MicProcessor | null = null;

export function getMicProcessor(): MicProcessor {
  if (!instance) {
    instance = new MicProcessor();
  }
  return instance;
}
