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
    float level = 0.0f;      // 0.0 to 1.0 (instantaneous)
    float peakHold = 0.0f;   // 0.0 to 1.0 (peak hold)

    static juce::Colour levelColour(float linear) {
      if (linear > 0.707f) return juce::Colour(0xffff4444);   // > -3dB -> red
      if (linear > 0.251f) return juce::Colour(0xffffb800);   // > -12dB -> yellow
      return juce::Colour(0xff00ff41);                         // green
    }

    void paint(juce::Graphics& g) override {
      auto bounds = getLocalBounds().toFloat();
      g.setColour(juce::Colours::black);
      g.fillRoundedRectangle(bounds, 2.0f);

      auto barWidth = bounds.getWidth() * level;
      if (barWidth > 0) {
        g.setColour(levelColour(level));
        g.fillRoundedRectangle(bounds.withWidth(barWidth), 2.0f);
      }

      // Peak hold line
      auto peakX = bounds.getWidth() * peakHold;
      if (peakX > 0.5f) {
        g.setColour(juce::Colours::white.withAlpha(0.9f));
        g.fillRect(peakX - 0.5f, 0.0f, 1.5f, bounds.getHeight());
      }

      g.setColour(juce::Colour(0xff00ff41).withAlpha(0.2f));
      g.drawRoundedRectangle(bounds, 2.0f, 1.0f);
    }
  };

  // Status dot indicator (child component, not hardcoded in paint)
  struct StatusDot : public juce::Component {
    juce::Colour colour = juce::Colour(0xffa0a0b0);
    void paint(juce::Graphics& g) override {
      g.setColour(colour);
      g.fillEllipse(0.0f, 0.0f, 8.0f, 8.0f);
      g.setColour(colour.withAlpha(0.3f));
      g.drawEllipse(-1.0f, -1.0f, 10.0f, 10.0f, 1.0f);
    }
  };

  MeterBar mLeftMeter;
  MeterBar mRightMeter;
  juce::Label mMeterLabelL;
  juce::Label mMeterLabelR;

  // Settings
  juce::Label mSampleRateLabel;

  // Connection
  juce::TextButton mStartStopButton;
  juce::Label mPortLabel;

  // Status
  StatusDot mStatusDot;
  int mActualPort = -1;

  void updateStatus();
  void updateMeters();

  JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(SonicBridgeAudioProcessorEditor)
};

} // namespace SonicBridge
