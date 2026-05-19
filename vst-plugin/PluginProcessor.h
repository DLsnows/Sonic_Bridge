#pragma once

#include <juce_audio_processors/juce_audio_processors.h>
#include <atomic>
#include "AudioEncoder.h"
#include "AudioMeter.h"
#include "VstBridgeServer.h"

namespace SonicBridge {

class SonicBridgeAudioProcessor : public juce::AudioProcessor {
public:
  SonicBridgeAudioProcessor();
  ~SonicBridgeAudioProcessor() override;

  // juce::AudioProcessor interface
  void prepareToPlay(double sampleRate, int samplesPerBlock) override;
  void releaseResources() override;
  void processBlock(juce::AudioBuffer<float>& buffer,
                    juce::MidiBuffer& midiMessages) override;

  juce::AudioProcessorEditor* createEditor() override;
  bool hasEditor() const override { return true; }

  const juce::String getName() const override { return "SonicBridge VST"; }

  bool acceptsMidi() const override { return false; }
  bool producesMidi() const override { return false; }
  double getTailLengthSeconds() const override { return 0.0; }

  int getNumPrograms() override { return 1; }
  int getCurrentProgram() override { return 0; }
  void setCurrentProgram(int) override {}
  const juce::String getProgramName(int) override { return {}; }
  void changeProgramName(int, const juce::String&) override {}

  void getStateInformation(juce::MemoryBlock& destData) override;
  void setStateInformation(const void* data, int sizeInBytes) override;

  // VST Bridge server access (for Editor)
  VstBridgeServer& getBridgeServer() { return mBridgeServer; }
  AudioMeter& getMeter() { return mMeter; }

  // Audio settings persistence
  int getCurrentBitrate() const { return mOpusBitrate.load(); }
  void setCurrentBitrate(int bitrate);

private:
  AudioEncoder mEncoder;
  AudioMeter mMeter;
  VstBridgeServer mBridgeServer;

  std::atomic<int> mOpusBitrate{128000};
  std::atomic<uint32_t> mAudioSeq{0};

  double mCurrentSampleRate = 48000.0;
  int mCurrentBlockSize = 256;

  // Work buffer for interleaved stereo
  juce::AudioBuffer<float> mWorkBuffer;

  // Opus frame accumulation (per-instance, not static)
  juce::AudioBuffer<float> mAccumulationBuffer{2, 960};
  int mAccumulatedSamples = 0;

  // Meter broadcast throttle
  int mMeterFrameCounter = 0;
  static constexpr int kMeterIntervalFrames = 4; // ~20 Hz at 256-sample blocks

  JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(SonicBridgeAudioProcessor)
};

} // namespace SonicBridge
