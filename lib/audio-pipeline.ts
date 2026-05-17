const RING_BUFFER_SIZE = 16384;

export class VstAudioPipeline {
  private audioContext: AudioContext | null = null;
  private destination: MediaStreamAudioDestinationNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private decoder: AudioDecoder | null = null;
  private sampleRate = 48000;
  private channels = 2;
  private ready = false;
  private destroyed = false;

  get isReady() {
    return this.ready;
  }

  static isSupported() {
    return (
      typeof AudioContext !== "undefined" &&
      typeof AudioDecoder !== "undefined" &&
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

    this.workletNode.connect(this.destination);

    this.decoder = new AudioDecoder({
      output: (audioData: AudioData) => {
        this.handleDecodedAudio(audioData);
        audioData.close();
      },
      error: (e: DOMException) => {
        console.error("VST audio decode error:", e.message);
      },
    });

    this.decoder.configure({
      codec: "opus",
      sampleRate,
      numberOfChannels: channels,
    });

    this.ready = true;
  }

  feedOpusPacket(opusData: Uint8Array) {
    if (!this.decoder || this.decoder.state !== "configured") return;

    const chunk = new EncodedAudioChunk({
      type: "key",
      timestamp: 0,
      data: opusData,
    });
    this.decoder.decode(chunk);
  }

  getMediaStreamTrack(): MediaStreamTrack | null {
    return this.destination?.stream.getAudioTracks()[0] ?? null;
  }

  shutdown() {
    this.destroyed = true;
    this.ready = false;

    if (this.decoder?.state === "configured") {
      this.decoder.close();
    }
    this.decoder = null;

    this.workletNode?.disconnect();
    this.workletNode = null;

    this.destination?.disconnect();
    this.destination = null;

    this.audioContext?.close();
    this.audioContext = null;
  }

  private handleDecodedAudio(audioData: AudioData) {
    if (!this.workletNode || this.destroyed) return;

    const frameSamples = audioData.numberOfFrames;
    const frameChannels = audioData.numberOfChannels;

    // Copy planar PCM data
    const buffers: Float32Array[] = [];
    for (let ch = 0; ch < frameChannels; ch++) {
      const plane = new Float32Array(frameSamples);
      audioData.copyTo(plane, { planeIndex: ch, format: "f32-planar" });
      buffers.push(plane);
    }

    // Send PCM to AudioWorklet via MessagePort
    this.workletNode.port.postMessage(
      {
        type: "pcm",
        sampleRate: audioData.sampleRate,
        channels: frameChannels,
        frames: frameSamples,
        buffers,
      },
      // Transfer the buffers to avoid copying
      buffers.map((b) => b.buffer),
    );
  }
}
