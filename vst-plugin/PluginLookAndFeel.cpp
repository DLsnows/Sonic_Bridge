#include "PluginLookAndFeel.h"

namespace SonicBridge {

PluginLookAndFeel::PluginLookAndFeel() {
  // Use monospace font for cyberpunk aesthetic
  setDefaultSansSerifTypeface(
    juce::Typeface::createSystemTypefaceFor(
      juce::Font("Fira Code", juce::Font::plain).toString().toRawUTF8(),
      juce::Font::getDefaultSansSerifFontName().toRawUTF8()
    )
  );
}

void PluginLookAndFeel::setColourScheme(
    LookAndFeel_V4::ColourScheme& scheme) {
  scheme.widgetColour = bgPanel;
  scheme.sliderFillColour = greenNeon;
  scheme.sliderTrackColour = greenNeon.withAlpha(0.3f);
  scheme.outlineColour = greenNeon.withAlpha(0.2f);
  scheme.windowBackground = bgDeep;
  scheme.defaultText = textPrimary;
  scheme.secondaryText = textSecondary;
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
  return juce::Font(12.0f, juce::Font::plain);
}

} // namespace SonicBridge
