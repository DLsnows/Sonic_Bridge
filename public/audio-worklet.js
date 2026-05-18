// AudioWorklet processor for VST audio playback
// Runs on a dedicated high-priority audio thread

const RING_CAPACITY = 16384;

class VstAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    // Allocate ring buffers (stereo)
    this.ringBuffer = [
      new Float32Array(RING_CAPACITY),
      new Float32Array(RING_CAPACITY),
    ];
    this.writePos = 0;
    this.readPos = 0;
    this.available = 0;
    this.channels = 2;

    this.port.onmessage = (event) => {
      const msg = event.data;
      if (msg.type === "pcm" && msg.buffers) {
        this.writePcm(msg);
      }
    };
  }

  process(_inputs, outputs, _parameters) {
    const output = outputs[0];
    if (!output || output.length === 0) return true;

    const outChannels = Math.min(output.length, this.channels);
    const framesToRead = output[0].length;

    if (this.available < framesToRead) {
      // Underrun: output silence
      for (let ch = 0; ch < outChannels; ch++) {
        output[ch].fill(0);
      }
      return true;
    }

    for (let ch = 0; ch < outChannels; ch++) {
      const rb = this.ringBuffer[ch];
      const out = output[ch];
      for (let i = 0; i < framesToRead; i++) {
        out[i] = rb[(this.readPos + i) % RING_CAPACITY];
      }
    }

    this.readPos = (this.readPos + framesToRead) % RING_CAPACITY;
    this.available -= framesToRead;

    return true;
  }

  writePcm(msg) {
    const { channels, frames, buffers } = msg;
    this.channels = Math.max(this.channels, channels);

    const framesToWrite = Math.min(frames, RING_CAPACITY - this.available);
    if (framesToWrite <= 0) return; // buffer full, drop frame

    for (let ch = 0; ch < Math.min(channels, this.ringBuffer.length); ch++) {
      const rb = this.ringBuffer[ch];
      const buf = buffers[ch];
      for (let i = 0; i < framesToWrite; i++) {
        rb[(this.writePos + i) % RING_CAPACITY] = buf != null ? buf[i] : 0;
      }
    }
    this.writePos = (this.writePos + framesToWrite) % RING_CAPACITY;

    this.available += framesToWrite;
  }
}

registerProcessor("vst-audio-processor", VstAudioProcessor);
