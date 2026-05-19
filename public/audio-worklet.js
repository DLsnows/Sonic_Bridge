// AudioWorklet processor for VST audio playback
// Runs on a dedicated high-priority audio thread

const DEFAULT_RING_CAPACITY = 16384; // default ~341ms at 48kHz

class VstAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    this.ringCapacity = DEFAULT_RING_CAPACITY;
    this.ringBuffer = [
      new Float32Array(this.ringCapacity),
      new Float32Array(this.ringCapacity),
    ];
    this.writePos = 0;
    this.readPos = 0;
    this.available = 0;
    this.channels = 2;

    this.port.onmessage = (event) => {
      const msg = event.data;
      if (msg.type === "pcm" && msg.buffers) {
        this.writePcm(msg);
      } else if (msg.type === "resize" && typeof msg.capacity === "number") {
        this.resize(msg.capacity);
      }
    };
  }

  resize(newCapacity) {
    if (newCapacity <= 0 || newCapacity === this.ringCapacity) return;
    this.ringCapacity = newCapacity;
    this.ringBuffer = [
      new Float32Array(newCapacity),
      new Float32Array(newCapacity),
    ];
    this.writePos = 0;
    this.readPos = 0;
    this.available = 0;
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
      const cap = this.ringCapacity;
      for (let i = 0; i < framesToRead; i++) {
        out[i] = rb[(this.readPos + i) % cap];
      }
    }

    this.readPos = (this.readPos + framesToRead) % this.ringCapacity;
    this.available -= framesToRead;

    return true;
  }

  writePcm(msg) {
    const { channels, frames, buffers } = msg;
    this.channels = Math.max(this.channels, channels);

    const framesToWrite = Math.min(frames, this.ringCapacity - this.available);
    if (framesToWrite <= 0) return; // buffer full, drop frame

    for (let ch = 0; ch < Math.min(channels, this.ringBuffer.length); ch++) {
      const rb = this.ringBuffer[ch];
      const buf = buffers[ch];
      const cap = this.ringCapacity;
      for (let i = 0; i < framesToWrite; i++) {
        rb[(this.writePos + i) % cap] = buf != null ? buf[i] : 0;
      }
    }
    this.writePos = (this.writePos + framesToWrite) % this.ringCapacity;

    this.available += framesToWrite;
  }
}

registerProcessor("vst-audio-processor", VstAudioProcessor);
