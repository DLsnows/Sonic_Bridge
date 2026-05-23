#include "PluginProcessor.h"
#include "PluginEditor.h"

namespace SonicBridge {

SonicBridgeAudioProcessor::SonicBridgeAudioProcessor()
    : juce::AudioProcessor(
          BusesProperties()
              .withInput("Input", juce::AudioChannelSet::stereo(), true)
              .withOutput("Output", juce::AudioChannelSet::stereo(), true)) {
  mBridgeServer.callbacks.onHandshake =
    [this](const juce::String& projectId,
           const juce::String& userId,
           const juce::String& username) {
      juce::ignoreUnused(projectId, userId, username);
      mBridgeServer.sendStatus(true, "SonicBridge VST",
                               JucePlugin_VersionString);
    };

  mBridgeServer.callbacks.onSettingsRequest =
    [this]() {
      juce::ignoreUnused();
    };
}

SonicBridgeAudioProcessor::~SonicBridgeAudioProcessor() {
  mBridgeServer.stop();
}

void SonicBridgeAudioProcessor::prepareToPlay(double sampleRate,
                                                int samplesPerBlock) {
  mCurrentSampleRate = sampleRate;
  mCurrentBlockSize = samplesPerBlock;

  // Note: WebSocket server is started via the editor's "Start Bridge" button
  // (message thread), NOT here on the audio thread.

  // Allocate work buffer for interleaving
  mWorkBuffer.setSize(2, samplesPerBlock, false, true, false);
}

void SonicBridgeAudioProcessor::releaseResources() {
}

void SonicBridgeAudioProcessor::processBlock(
    juce::AudioBuffer<float>& buffer,
    juce::MidiBuffer& /*midiMessages*/) {

  juce::ScopedNoDenormals noDenormals;
  const int numSamples = buffer.getNumSamples();

  if (mBridgeServer.getClientCount() == 0) return;

  // Interleave stereo for PCM send
  auto* leftChannel = buffer.getReadPointer(0);
  auto* rightChannel = buffer.getReadPointer(1);
  auto* workBuffer = mWorkBuffer.getWritePointer(0);

  for (int i = 0; i < numSamples; ++i) {
    workBuffer[i * 2] = leftChannel[i];
    workBuffer[i * 2 + 1] = rightChannel[i];
  }

  // Send raw PCM as binary WebSocket frame
  mBridgeServer.sendPcmPacket(
    workBuffer,
    numSamples,
    static_cast<int>(mCurrentSampleRate),
    2
  );

  // Update meter
  mMeter.process(workBuffer, numSamples);
  if (++mMeterFrameCounter >= kMeterIntervalFrames) {
    mMeterFrameCounter = 0;
    auto levels = mMeter.getLevels();
    mBridgeServer.sendMeterLevels(levels.left, levels.right, levels.peak);
  }
}

juce::AudioProcessorEditor* SonicBridgeAudioProcessor::createEditor() {
  return new SonicBridgeAudioProcessorEditor(*this);
}

void SonicBridgeAudioProcessor::getStateInformation(
    juce::MemoryBlock& destData) {
  juce::MemoryOutputStream stream(destData, true);
  stream.writeInt(0); // reserved
}

void SonicBridgeAudioProcessor::setStateInformation(
    const void* data, int sizeInBytes) {
  juce::ignoreUnused(data, sizeInBytes);
}

} // namespace SonicBridge

// JUCE plugin factory
juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter() {
  return new SonicBridge::SonicBridgeAudioProcessor();
}
