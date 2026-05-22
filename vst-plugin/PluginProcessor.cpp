#include "PluginProcessor.h"
#include "PluginEditor.h"

namespace SonicBridge {

SonicBridgeAudioProcessor::SonicBridgeAudioProcessor()
    : juce::AudioProcessor(
          BusesProperties()
              .withInput("Input", juce::AudioChannelSet::stereo(), true)
              .withOutput("Output", juce::AudioChannelSet::stereo(), true)) {
  // Setup bridge callbacks
  mBridgeServer.callbacks.onHandshake =
    [this](const juce::String& projectId,
           const juce::String& userId,
           const juce::String& username) {
      juce::ignoreUnused(projectId, userId, username);
      mBridgeServer.sendStatus(true, "SonicBridge VST",
                               JucePlugin_VersionString);
      mBridgeServer.sendSettings(
        static_cast<int>(mCurrentSampleRate),
        mCurrentBlockSize,
        2,
        mOpusBitrate.load()
      );
    };

  mBridgeServer.callbacks.onBitrateChange =
    [this](int bitrate) {
      setCurrentBitrate(bitrate);
      mBridgeServer.sendSettings(
        static_cast<int>(mCurrentSampleRate),
        mCurrentBlockSize,
        2,
        mOpusBitrate.load()
      );
    };

  mBridgeServer.callbacks.onSettingsRequest =
    [this]() {
      mBridgeServer.sendSettings(
        static_cast<int>(mCurrentSampleRate),
        mCurrentBlockSize,
        2,
        mOpusBitrate.load()
      );
    };
}

SonicBridgeAudioProcessor::~SonicBridgeAudioProcessor() {
  mBridgeServer.stop();
}

void SonicBridgeAudioProcessor::prepareToPlay(double sampleRate,
                                                int samplesPerBlock) {
  mCurrentSampleRate = sampleRate;
  mCurrentBlockSize = samplesPerBlock;

  // Initialize Opus encoder (20ms frames)
  mEncoder.initialize(static_cast<int>(sampleRate), 2, mOpusBitrate.load());

  // Note: WebSocket server is started via the editor's "Start Bridge" button
  // (message thread), NOT here on the audio thread. Starting a network server
  // on the realtime audio thread can block for hundreds of milliseconds,
  // causing host watchdog timeouts and UI-open crashes.

  // Allocate work buffer for interleaving
  mWorkBuffer.setSize(2, samplesPerBlock, false, true, false);
}

void SonicBridgeAudioProcessor::releaseResources() {
  mEncoder.shutdown();
}

void SonicBridgeAudioProcessor::processBlock(
    juce::AudioBuffer<float>& buffer,
    juce::MidiBuffer& /*midiMessages*/) {

  juce::ScopedNoDenormals noDenormals;
  const int numSamples = buffer.getNumSamples();

  // Skip processing if no clients connected
  if (mBridgeServer.getClientCount() == 0) return;

  // Process through DAW normally (input = output, passthrough)
  // Audio is copied before any modifications

  // Encode the input audio to Opus and stream
  if (mEncoder.isInitialized()) {
    // Interleave stereo channels for encoder
    auto* leftChannel = buffer.getReadPointer(0);
    auto* rightChannel = buffer.getReadPointer(1);
    auto* workBuffer = mWorkBuffer.getWritePointer(0);

    for (int i = 0; i < numSamples; ++i) {
      workBuffer[i * 2] = leftChannel[i];
      workBuffer[i * 2 + 1] = rightChannel[i];
    }

    // Opus frame accumulation (per-instance member variables, not static)
    int remaining = numSamples;
    int offset = 0;

    while (remaining > 0) {
      int toCopy = juce::jmin(remaining, 960 - mAccumulatedSamples);

      mAccumulationBuffer.copyFrom(0, mAccumulatedSamples,
                                   buffer, 0, offset, toCopy);
      mAccumulationBuffer.copyFrom(1, mAccumulatedSamples,
                                   buffer, 1, offset, toCopy);
      mAccumulatedSamples += toCopy;
      offset += toCopy;
      remaining -= toCopy;

      if (mAccumulatedSamples >= 960) {
        auto encoded = mEncoder.encode(
          mAccumulationBuffer.getReadPointer(0), // interleaved
          960
        );

        if (!encoded.empty()) {
          auto seq = mAudioSeq.fetch_add(1);
          auto now = juce::Time::getMillisecondCounterHiRes();
          mBridgeServer.sendAudioPacket(
            seq,
            static_cast<uint64_t>(now * 1000.0), // microseconds
            static_cast<int>(mCurrentSampleRate),
            2,
            960,
            encoded
          );
        }

        mAccumulatedSamples = 0;
      }
    }

    // Update meter and broadcast periodically
    mMeter.process(workBuffer, numSamples);
    if (++mMeterFrameCounter >= kMeterIntervalFrames) {
      mMeterFrameCounter = 0;
      auto levels = mMeter.getLevels();
      mBridgeServer.sendMeterLevels(levels.left, levels.right, levels.peak);
    }
  }
}

juce::AudioProcessorEditor* SonicBridgeAudioProcessor::createEditor() {
  return new SonicBridgeAudioProcessorEditor(*this);
}

void SonicBridgeAudioProcessor::getStateInformation(
    juce::MemoryBlock& destData) {
  juce::MemoryOutputStream stream(destData, true);
  stream.writeInt(mOpusBitrate.load());
}

void SonicBridgeAudioProcessor::setStateInformation(
    const void* data, int sizeInBytes) {
  juce::MemoryInputStream stream(data, static_cast<size_t>(sizeInBytes), false);
  int bitrate = stream.readInt();
  if (bitrate > 0) {
    setCurrentBitrate(bitrate);
  }
}

void SonicBridgeAudioProcessor::setCurrentBitrate(int bitrate) {
  mOpusBitrate = bitrate;
  mEncoder.setBitrate(bitrate);
}

} // namespace SonicBridge

// JUCE plugin factory
juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter() {
  return new SonicBridge::SonicBridgeAudioProcessor();
}
