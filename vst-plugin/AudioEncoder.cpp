#include "AudioEncoder.h"

namespace SonicBridge {

AudioEncoder::AudioEncoder() = default;

AudioEncoder::~AudioEncoder() {
  shutdown();
}

bool AudioEncoder::initialize(int sampleRate, int channels, int bitrate) {
  shutdown();

  mSampleRate = sampleRate;
  mChannels = channels;
  mBitrate = bitrate;

  int error = 0;
  mEncoder = opus_encoder_create(sampleRate, channels, OPUS_APPLICATION_AUDIO, &error);

  if (error != OPUS_OK || mEncoder == nullptr) {
    mEncoder = nullptr;
    return false;
  }

  opus_encoder_ctl(mEncoder, OPUS_SET_BITRATE(bitrate));
  // 20ms frames = 960 samples at 48kHz, 960 samples = max Opus packet
  opus_encoder_ctl(mEncoder, OPUS_SET_COMPLEXITY(8)); // 0-10, higher = better quality
  opus_encoder_ctl(mEncoder, OPUS_SET_SIGNAL(OPUS_SIGNAL_MUSIC));

  return true;
}

void AudioEncoder::shutdown() {
  if (mEncoder) {
    opus_encoder_destroy(mEncoder);
    mEncoder = nullptr;
  }
}

std::vector<uint8_t> AudioEncoder::encode(const float* interleavedSamples, int numSamples) {
  if (!mEncoder) return {};

  // Opus max packet size: 4000 bytes
  std::vector<uint8_t> output(4000);

  int encodedBytes = opus_encode_float(
    mEncoder,
    interleavedSamples,
    numSamples,
    output.data(),
    static_cast<opus_int32>(output.size())
  );

  if (encodedBytes < 0) {
    return {}; // encoding error
  }

  output.resize(static_cast<size_t>(encodedBytes));
  return output;
}

void AudioEncoder::setBitrate(int bitrate) {
  mBitrate = bitrate;
  if (mEncoder) {
    opus_encoder_ctl(mEncoder, OPUS_SET_BITRATE(bitrate));
  }
}

} // namespace SonicBridge
