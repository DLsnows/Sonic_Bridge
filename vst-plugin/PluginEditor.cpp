#include "PluginEditor.h"

namespace SonicBridge {

static float dBToLinear(float db) {
  if (db < -60.0f) return 0.0f;
  return juce::jlimit(0.0f, 1.0f, (db + 60.0f) / 60.0f);
}

SonicBridgeAudioProcessorEditor::SonicBridgeAudioProcessorEditor(
    SonicBridgeAudioProcessor& processor)
    : juce::AudioProcessorEditor(&processor),
      mProcessor(processor) {

  setLookAndFeel(&mLookAndFeel);
  setSize(360, 420);

  // Status label
  mStatusLabel.setText("Disconnected", juce::dontSendNotification);
  mStatusLabel.setFont(juce::Font(juce::FontOptions(14.0f, juce::Font::bold)));
  mStatusLabel.setColour(juce::Label::textColourId,
                         juce::Colour(0xffa0a0b0));
  addAndMakeVisible(mStatusLabel);

  mPluginInfoLabel.setText("SonicBridge VST " JucePlugin_VersionString,
                           juce::dontSendNotification);
  mPluginInfoLabel.setFont(juce::Font(juce::FontOptions().withHeight(11.0f)));
  mPluginInfoLabel.setColour(juce::Label::textColourId,
                             juce::Colour(0xffa0a0b0));
  addAndMakeVisible(mPluginInfoLabel);

  mClientCountLabel.setText("Clients: 0", juce::dontSendNotification);
  mClientCountLabel.setFont(juce::Font(juce::FontOptions().withHeight(10.0f)));
  mClientCountLabel.setColour(juce::Label::textColourId,
                              juce::Colour(0xffa0a0b0));
  addAndMakeVisible(mClientCountLabel);

  // Meters
  mLeftMeter.barColour = juce::Colour(0xff00ff41);
  addAndMakeVisible(mLeftMeter);
  mRightMeter.barColour = juce::Colour(0xff00ff41);
  addAndMakeVisible(mRightMeter);

  mMeterLabelL.setText("L", juce::dontSendNotification);
  mMeterLabelL.setFont(juce::Font(juce::FontOptions().withHeight(10.0f)));
  mMeterLabelL.setColour(juce::Label::textColourId,
                         juce::Colour(0xffa0a0b0));
  addAndMakeVisible(mMeterLabelL);

  mMeterLabelR.setText("R", juce::dontSendNotification);
  mMeterLabelR.setFont(juce::Font(juce::FontOptions().withHeight(10.0f)));
  mMeterLabelR.setColour(juce::Label::textColourId,
                         juce::Colour(0xffa0a0b0));
  addAndMakeVisible(mMeterLabelR);

  // Bitrate slider
  mBitrateSlider.setRange(32000, 320000, 8000);
  mBitrateSlider.setValue(mProcessor.getCurrentBitrate(),
                          juce::dontSendNotification);
  mBitrateSlider.setTextValueSuffix(" bps");
  mBitrateSlider.onValueChange = [this]() {
    int bitrate = static_cast<int>(mBitrateSlider.getValue());
    mProcessor.setCurrentBitrate(bitrate);
    mBitrateLabel.setText(
      juce::String(bitrate / 1000) + " kbps",
      juce::dontSendNotification
    );
  };
  addAndMakeVisible(mBitrateSlider);

  mBitrateLabel.setText(
    juce::String(mProcessor.getCurrentBitrate() / 1000) + " kbps",
    juce::dontSendNotification
  );
  mBitrateLabel.setFont(juce::Font(juce::FontOptions().withHeight(10.0f)));
  mBitrateLabel.setColour(juce::Label::textColourId,
                          juce::Colour(0xfff0f0f0));
  addAndMakeVisible(mBitrateLabel);

  // Audio info
  mSampleRateLabel.setText("48 kHz", juce::dontSendNotification);
  mSampleRateLabel.setFont(juce::Font(juce::FontOptions().withHeight(10.0f)));
  mSampleRateLabel.setColour(juce::Label::textColourId,
                             juce::Colour(0xffa0a0b0));
  addAndMakeVisible(mSampleRateLabel);

  mBufferSizeLabel.setText("256 smp", juce::dontSendNotification);
  mBufferSizeLabel.setFont(juce::Font(juce::FontOptions().withHeight(10.0f)));
  mBufferSizeLabel.setColour(juce::Label::textColourId,
                             juce::Colour(0xffa0a0b0));
  addAndMakeVisible(mBufferSizeLabel);

  // Start/Stop button
  mStartStopButton.setButtonText("Start Bridge");
  mStartStopButton.onClick = [this]() {
    auto& server = mProcessor.getBridgeServer();
    if (server.isRunning()) {
      server.stop();
      mStartStopButton.setButtonText("Start Bridge");
    } else {
      server.start(9420);
      mStartStopButton.setButtonText("Stop Bridge");
    }
  };
  addAndMakeVisible(mStartStopButton);

  mPortLabel.setText("ws://localhost:9420", juce::dontSendNotification);
  mPortLabel.setFont(juce::Font(juce::FontOptions().withHeight(10.0f)));
  mPortLabel.setColour(juce::Label::textColourId,
                       juce::Colour(0xffa0a0b0));
  addAndMakeVisible(mPortLabel);

  // Start 20 Hz timer for UI updates
  startTimerHz(20);
}

SonicBridgeAudioProcessorEditor::~SonicBridgeAudioProcessorEditor() {
  stopTimer();
  setLookAndFeel(nullptr);
}

void SonicBridgeAudioProcessorEditor::paint(juce::Graphics& g) {
  // Cyberpunk dark background
  g.fillAll(juce::Colour(0xff09090b));

  // Scanline overlay effect
  for (int y = 0; y < getHeight(); y += 3) {
    g.setColour(juce::Colour(0x00ff41).withAlpha(0.02f));
    g.fillRect(0, y, getWidth(), 1);
  }

  // Header
  g.setColour(juce::Colour(0xff00ff41));
  g.setFont(18.0f);
  g.drawText("SonicBridge VST",
             getLocalBounds().removeFromTop(40).toFloat(),
             juce::Justification::centred);

  // Connection indicator (circle)
  auto& server = mProcessor.getBridgeServer();
  auto statusColour = server.isRunning() && server.getClientCount() > 0
                        ? juce::Colour(0xff00ff41)
                        : (server.isRunning()
                             ? juce::Colour(0xffffb800)
                             : juce::Colour(0xffa0a0b0));
  g.setColour(statusColour);
  g.fillEllipse(165, 10, 8, 8);

  // Gloss effect on circle
  g.setColour(statusColour.withAlpha(0.3f));
  g.drawEllipse(163, 8, 12, 12, 1.0f);
}

void SonicBridgeAudioProcessorEditor::resized() {
  auto area = getLocalBounds().reduced(12);

  area.removeFromTop(44); // header

  // Status row
  auto statusRow = area.removeFromTop(36);
  mStatusLabel.setBounds(statusRow.removeFromLeft(120));
  mClientCountLabel.setBounds(statusRow.removeFromRight(80));

  // Plugin info
  mPluginInfoLabel.setBounds(area.removeFromTop(18));

  area.removeFromTop(8);

  // Meters
  auto meterArea = area.removeFromTop(60);
  auto leftMeterArea = meterArea.removeFromLeft(meterArea.getWidth() / 2 - 20);
  mMeterLabelL.setBounds(leftMeterArea.removeFromLeft(16));
  mLeftMeter.setBounds(leftMeterArea.reduced(0, 10));

  meterArea.removeFromLeft(40); // gap
  auto rightMeterArea = meterArea;
  mMeterLabelR.setBounds(rightMeterArea.removeFromLeft(16));
  mRightMeter.setBounds(rightMeterArea.reduced(0, 10));

  area.removeFromTop(8);

  // Audio info
  auto infoRow = area.removeFromTop(18);
  mSampleRateLabel.setBounds(infoRow.removeFromLeft(80));
  mBufferSizeLabel.setBounds(infoRow.removeFromRight(80));

  area.removeFromTop(4);

  // Bitrate
  mBitrateLabel.setBounds(area.removeFromTop(16));
  auto sliderArea = area.removeFromTop(40);
  mBitrateSlider.setBounds(sliderArea);

  area.removeFromTop(8);

  // Port info
  mPortLabel.setBounds(area.removeFromTop(16));

  // Start/Stop button
  mStartStopButton.setBounds(area.removeFromTop(32).reduced(40, 0));
}

void SonicBridgeAudioProcessorEditor::timerCallback() {
  // Guard against calls during teardown — the processor reference
  // may be invalid if the editor outlives the processor.
  if (&mProcessor == nullptr) return;

  updateStatus();
  updateMeters();
}

void SonicBridgeAudioProcessorEditor::updateStatus() {
  try {
    auto& server = mProcessor.getBridgeServer();
    if (!server.isRunning()) {
      mStatusLabel.setText("Offline", juce::dontSendNotification);
      mStatusLabel.setColour(juce::Label::textColourId,
                             juce::Colour(0xffa0a0b0));
    } else if (server.getClientCount() > 0) {
      mStatusLabel.setText("Connected", juce::dontSendNotification);
      mStatusLabel.setColour(juce::Label::textColourId,
                             juce::Colour(0xff00ff41));
    } else {
      mStatusLabel.setText("Waiting...", juce::dontSendNotification);
      mStatusLabel.setColour(juce::Label::textColourId,
                             juce::Colour(0xffffb800));
    }

    mClientCountLabel.setText(
      "Clients: " + juce::String(server.getClientCount()),
      juce::dontSendNotification
    );

    mStartStopButton.setButtonText(
      server.isRunning() ? "Stop Bridge" : "Start Bridge"
    );

    repaint();
  } catch (...) {
    // Silently ignore — editor is being torn down
  }
}

void SonicBridgeAudioProcessorEditor::updateMeters() {
  try {
    auto levels = mProcessor.getMeter().getLevels();
    mLeftMeter.level = dBToLinear(levels.left);
    mRightMeter.level = dBToLinear(levels.right);
    mLeftMeter.repaint();
    mRightMeter.repaint();
  } catch (...) {
    // Silently ignore — editor is being torn down
  }
}

} // namespace SonicBridge
