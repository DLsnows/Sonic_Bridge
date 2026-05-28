#pragma once

#include <juce_gui_basics/juce_gui_basics.h>

namespace SonicBridge {

// Cyberpunk dark theme matching the SonicBridge web client
class PluginLookAndFeel : public juce::LookAndFeel_V4 {
public:
  PluginLookAndFeel();
  ~PluginLookAndFeel() override = default;

  // Slider style (rotary with neon glow)
  void drawRotarySlider(juce::Graphics& g, int x, int y, int width,
                        int height, float sliderPos,
                        float rotaryStartAngle, float rotaryEndAngle,
                        juce::Slider& slider) override;

  // Button style
  void drawButtonBackground(juce::Graphics& g, juce::Button& button,
                            const juce::Colour& backgroundColour,
                            bool shouldDrawButtonAsHighlighted,
                            bool shouldDrawButtonAsDown) override;

  void drawButtonText(juce::Graphics& g, juce::TextButton& button,
                      bool shouldDrawButtonAsHighlighted,
                      bool shouldDrawButtonAsDown) override;

  // Label style
  juce::Font getLabelFont(juce::Label& label) override;

private:
  // SonicBridge colour palette
  juce::Colour bgDeep{0xff09090b};
  juce::Colour bgPanel{0xff0f0f13};
  juce::Colour greenNeon{0xff00ff41};
  juce::Colour cyan{0xff00f0ff};
  juce::Colour purple{0xffb44dff};
  juce::Colour textPrimary{0xfff0f0f0};
  juce::Colour textSecondary{0xffa0a0b0};
  juce::Colour errorRed{0xffff4444};
  juce::Colour warningYellow{0xffffb800};
};

} // namespace SonicBridge
