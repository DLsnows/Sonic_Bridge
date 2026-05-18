#include "PluginLookAndFeel.h"

namespace SonicBridge {

PluginLookAndFeel::PluginLookAndFeel() {
  // Set cyberpunk dark colour scheme
  setColour(juce::ResizableWindow::backgroundColourId, bgDeep);
  setColour(juce::TextEditor::backgroundColourId, bgPanel);
  setColour(juce::TextEditor::textColourId, textPrimary);
  setColour(juce::TextEditor::outlineColourId, greenNeon.withAlpha(0.2f));
  setColour(juce::Slider::thumbColourId, greenNeon);
  setColour(juce::Slider::trackColourId, greenNeon.withAlpha(0.3f));
  setColour(juce::Slider::rotarySliderFillColourId, greenNeon);
  setColour(juce::Slider::backgroundColourId, bgPanel);
  setColour(juce::TextButton::buttonColourId, greenNeon.withAlpha(0.1f));
  setColour(juce::TextButton::buttonOnColourId, greenNeon.withAlpha(0.2f));
  setColour(juce::TextButton::textColourOffId, textPrimary);
  setColour(juce::TextButton::textColourOnId, greenNeon);
  setColour(juce::Label::textColourId, textSecondary);
  setColour(juce::ComboBox::backgroundColourId, bgPanel);
  setColour(juce::ComboBox::textColourId, textPrimary);
  setColour(juce::ComboBox::outlineColourId, greenNeon.withAlpha(0.2f));
  setColour(juce::PopupMenu::backgroundColourId, bgPanel);
  setColour(juce::PopupMenu::textColourId, textPrimary);
  setColour(juce::PopupMenu::highlightedBackgroundColourId, greenNeon.withAlpha(0.15f));

  setDefaultSansSerifTypeface(
    juce::Typeface::createSystemTypefaceFor(
      nullptr, 0
    )
  );
}

void PluginLookAndFeel::drawRotarySlider(
    juce::Graphics& g, int x, int y, int width, int height,
    float sliderPos, float rotaryStartAngle, float rotaryEndAngle,
    juce::Slider& slider) {

  auto radius = juce::jmin(width / 2, height / 2) - 4.0f;
  auto centreX = static_cast<float>(x) + width * 0.5f;
  auto centreY = static_cast<float>(y) + height * 0.5f;
  auto rx = centreX - radius;
  auto ry = centreY - radius;
  auto rw = radius * 2.0f;

  // Track arc
  juce::Path trackArc;
  trackArc.addCentredArc(centreX, centreY, radius, radius, 0.0f,
                         rotaryStartAngle, rotaryEndAngle, true);
  g.setColour(greenNeon.withAlpha(0.15f));
  g.strokePath(trackArc, juce::PathStrokeType(3.0f));

  // Value arc
  auto angle = rotaryStartAngle + sliderPos * (rotaryEndAngle - rotaryStartAngle);
  juce::Path valueArc;
  valueArc.addCentredArc(centreX, centreY, radius, radius, 0.0f,
                         rotaryStartAngle, angle, true);
  g.setColour(greenNeon);
  g.strokePath(valueArc, juce::PathStrokeType(3.0f));

  // Thumb
  juce::Path thumb;
  thumb.addRectangle(-3.0f, -radius, 6.0f, radius * 0.35f);
  g.setColour(greenNeon);
  g.fillPath(thumb, juce::AffineTransform::rotation(angle).translated(centreX, centreY));
}

void PluginLookAndFeel::drawButtonBackground(
    juce::Graphics& g, juce::Button& button,
    const juce::Colour& /*backgroundColour*/,
    bool shouldDrawButtonAsHighlighted,
    bool shouldDrawButtonAsDown) {

  auto bounds = button.getLocalBounds().toFloat().reduced(1.0f);
  auto baseColour = button.getToggleState() ? greenNeon.withAlpha(0.2f)
                                            : greenNeon.withAlpha(0.1f);

  if (shouldDrawButtonAsDown)
    baseColour = greenNeon.withAlpha(0.3f);
  else if (shouldDrawButtonAsHighlighted)
    baseColour = greenNeon.withAlpha(0.25f);

  g.setColour(baseColour);
  g.fillRoundedRectangle(bounds, 4.0f);

  g.setColour(greenNeon.withAlpha(0.3f));
  g.drawRoundedRectangle(bounds, 4.0f, 1.0f);
}

void PluginLookAndFeel::drawButtonText(
    juce::Graphics& g, juce::TextButton& button,
    bool /*shouldDrawButtonAsHighlighted*/,
    bool /*shouldDrawButtonAsDown*/) {
  g.setColour(button.getToggleState() ? greenNeon : textPrimary);
  g.setFont(12.0f);
  g.drawText(button.getButtonText(), button.getLocalBounds(),
             juce::Justification::centred);
}

juce::Font PluginLookAndFeel::getLabelFont(juce::Label& /*label*/) {
  return juce::Font(juce::FontOptions().withHeight(12.0f));
}

} // namespace SonicBridge
