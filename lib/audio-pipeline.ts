export class VstAudioPipeline {
  private audioContext: AudioContext | null = null;
  private destination: MediaStreamAudioDestinationNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private sampleRate = 48000;
  private channels = 2;
  private ready = false;
  private destroyed = false;
  private gainNode: GainNode | null = null;

  get isReady() {
    return this.ready;
  }

  static isSupported() {
    // No WebCodecs dependency — works in any browser with AudioContext + AudioWorklet
    return (
      typeof AudioContext !== "undefined" &&
      typeof AudioWorkletNode !== "undefined"
    );
  }

  async initialize(sampleRate: number, channels: number) {
    if (this.destroyed) return;
    this.sampleRate = sampleRate;
    this.channels = channels;

    this.audioContext = new AudioContext({ sampleRate });

    // Register AudioWorklet processor from public/
    await this.audioContext.audioWorklet.addModule("/audio-worklet.js");

    this.destination = this.audioContext.createMediaStreamDestination();

    this.workletNode = new AudioWorkletNode(
      this.audioContext,
      "vst-audio-processor",
      {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [channels],
      },
    );

    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = 1.0;
    this.workletNode.connect(this.gainNode);
    this.gainNode.connect(this.destination);

    this.ready = true;
  }

  // Feed interleaved PCM directly — deinterleave and send to AudioWorklet
  feedPcm(
    interleaved: Float32Array,
    sampleRate: number,
    channels: number,
    numSamples: number,
  ) {
    if (!this.workletNode || this.destroyed) return;

    // Deinterleave
    const buffers: Float32Array[] = [];
    for (let ch = 0; ch < channels; ch++) {
      const plane = new Float32Array(numSamples);
      for (let i = 0; i < numSamples; i++) {
        plane[i] = interleaved[i * channels + ch];
      }
      buffers.push(plane);
    }

    // Send to AudioWorklet via MessagePort (transfer buffers to avoid copying)
    this.workletNode.port.postMessage(
      {
        type: "pcm",
        sampleRate,
        channels,
        frames: numSamples,
        buffers,
      },
      buffers.map((b) => b.buffer),
    );
  }

  getMediaStreamTrack(): MediaStreamTrack | null {
    return this.destination?.stream.getAudioTracks()[0] ?? null;
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

  setReceiveBufferSize(samples: number) {
    if (this.workletNode && !this.destroyed) {
      this.workletNode.port.postMessage({ type: "resize", capacity: samples });
    }
  }

  shutdown() {
    this.destroyed = true;
    this.ready = false;

    this.workletNode?.disconnect();
    this.workletNode = null;

    this.gainNode?.disconnect();
    this.gainNode = null;

    this.destination?.disconnect();
    this.destination = null;

    this.audioContext?.close();
    this.audioContext = null;
  }
}
