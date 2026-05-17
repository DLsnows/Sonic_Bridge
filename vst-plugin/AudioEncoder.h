#pragma once

#include <juce_core/juce_core.h>
#include <opus/opus.h>
#include <vector>

namespace SonicBridge {

class AudioEncoder {
public:
  AudioEncoder();
  ~AudioEncoder();

  AudioEncoder(const AudioEncoder&) = delete;
  AudioEncoder& operator=(const AudioEncoder&) = delete;

  bool initialize(int sampleRate, int channels, int bitrate = 128000);
  void shutdown();

  // Encode a stereo interleaved float buffer to an Opus packet.
  // Returns the encoded bytes (empty on failure).
  std::vector<uint8_t> encode(const float* interleavedSamples, int numSamples);

  // Adjust bitrate on the fly (bps, e.g. 96000, 128000, 256000).
  void setBitrate(int bitrate);

  int getSampleRate() const { return mSampleRate; }
  int getChannels() const { return mChannels; }
  int getBitrate() const { return mBitrate; }
  bool isInitialized() const { return mEncoder != nullptr; }

private:
  OpusEncoder* mEncoder = nullptr;
  int mSampleRate = 48000;
  int mChannels = 2;
  int mBitrate = 128000;
};

} // namespace SonicBridge
