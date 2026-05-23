#pragma once

#include <juce_audio_processors/juce_audio_processors.h>
#include <juce_gui_basics/juce_gui_basics.h>
#include "PluginProcessor.h"
#include "PluginLookAndFeel.h"

namespace SonicBridge {

class SonicBridgeAudioProcessorEditor
    : public juce::AudioProcessorEditor,
      public juce::Timer {
public:
  explicit SonicBridgeAudioProcessorEditor(SonicBridgeAudioProcessor& processor);
  ~SonicBridgeAudioProcessorEditor() override;

  void paint(juce::Graphics& g) override;
  void resized() override;
  void timerCallback() override;

private:
  SonicBridgeAudioProcessor& mProcessor;
  PluginLookAndFeel mLookAndFeel;

  // Status indicator
  juce::Label mStatusLabel;
  juce::Label mPluginInfoLabel;
  juce::Label mClientCountLabel;

  // Volume meters
  struct MeterBar : public juce::Component {
    juce::Colour barColour;
    float level = 0.0f; // 0.0 to 1.0

    void paint(juce::Graphics& g) override {
      auto bounds = getLocalBounds().toFloat();
      g.setColour(juce::Colours::black);
      g.fillRoundedRectangle(bounds, 2.0f);

      auto barWidth = bounds.getWidth() * level;
      if (barWidth > 0) {
        g.setColour(barColour);
        g.fillRoundedRectangle(bounds.withWidth(barWidth), 2.0f);
      }

      g.setColour(juce::Colour(0xff00ff41).withAlpha(0.2f));
      g.drawRoundedRectangle(bounds, 2.0f, 1.0f);
    }
  };

  MeterBar mLeftMeter;
  MeterBar mRightMeter;
  juce::Label mMeterLabelL;
  juce::Label mMeterLabelR;

  // Settings
  juce::Label mSampleRateLabel;
  juce::Label mBufferSizeLabel;

  // Connection
  juce::TextButton mStartStopButton;
  juce::Label mPortLabel;

  void updateStatus();
  void updateMeters();

  JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(SonicBridgeAudioProcessorEditor)
};

} // namespace SonicBridge
