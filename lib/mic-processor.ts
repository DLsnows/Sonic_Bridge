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
  private gainNode: GainNode | null = null;
  private destination: MediaStreamAudioDestinationNode | null = null;

  async init(opts: AudioProcessorOptions): Promise<void> {
    const { audioContext, track } = opts;
    this.audioContext = audioContext;

    this.sourceNode = audioContext.createMediaStreamSource(
      new MediaStream([track]),
    );
    this.gainNode = audioContext.createGain();
    this.gainNode.gain.value = useVstStore.getState().micVolume;
    this.destination = audioContext.createMediaStreamDestination();

    this.sourceNode.connect(this.gainNode).connect(this.destination);
    this.processedTrack = this.destination.stream.getAudioTracks()[0];
  }

  async restart(opts: AudioProcessorOptions): Promise<void> {
    const { audioContext, track } = opts;

    if (this.sourceNode) {
      this.sourceNode.disconnect();
    }

    this.sourceNode = audioContext.createMediaStreamSource(
      new MediaStream([track]),
    );
    if (this.gainNode && this.destination) {
      this.sourceNode.connect(this.gainNode).connect(this.destination);
    }
  }

  async destroy(): Promise<void> {
    this.sourceNode?.disconnect();
    this.gainNode?.disconnect();
    this.sourceNode = null;
    this.gainNode = null;
    this.destination = null;
    this.audioContext = null;
    this.processedTrack = undefined;
  }

  setVolume(volume: number) {
    if (this.gainNode && this.audioContext) {
      const clamped = Math.max(0, Math.min(1, volume));
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
      noiseSuppression: true,
      autoGainControl: true,
    };
  }
}

let instance: MicProcessor | null = null;

export function getMicProcessor(): MicProcessor {
  if (!instance) {
    instance = new MicProcessor();
  }
  return instance;
}
