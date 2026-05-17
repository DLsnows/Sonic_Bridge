#include "AudioMeter.h"
#include <algorithm>
#include <cmath>

namespace SonicBridge {

void AudioMeter::process(const float* interleavedSamples, int numSamples) {
  if (numSamples <= 0) return;

  float peakL = 0.0f;
  float peakR = 0.0f;
  double sumSqL = 0.0;
  double sumSqR = 0.0;

  for (int i = 0; i < numSamples; ++i) {
    float left  = interleavedSamples[i * 2];
    float right = interleavedSamples[i * 2 + 1];

    float absL = std::abs(left);
    float absR = std::abs(right);

    if (absL > peakL) peakL = absL;
    if (absR > peakR) peakR = absR;

    sumSqL += static_cast<double>(left) * left;
    sumSqR += static_cast<double>(right) * right;
  }

  mCurrentPeakLeft  = peakL;
  mCurrentPeakRight = peakR;
  mCurrentRMSLeft   = static_cast<float>(std::sqrt(sumSqL / numSamples));
  mCurrentRMSRight  = static_cast<float>(std::sqrt(sumSqR / numSamples));

  // Peak hold with decay
  if (peakL > mHoldPeakLeft) {
    mHoldPeakLeft = peakL;
    mHoldCounter = 0;
  }
  if (peakR > mHoldPeakRight) {
    mHoldPeakRight = peakR;
    mHoldCounter = 0;
  }

  // Decay hold after ~2 seconds (at ~20 updates/sec = 40 counts)
  if (++mHoldCounter > 40) {
    mHoldPeakLeft  *= 0.95f;
    mHoldPeakRight *= 0.95f;
  }
}

MeterLevels AudioMeter::getLevels() const {
  return {
    amplitudeToDB(mCurrentRMSLeft),
    amplitudeToDB(mCurrentRMSRight),
    amplitudeToDB(std::max(mHoldPeakLeft, mHoldPeakRight))
  };
}

void AudioMeter::resetHold() {
  mHoldPeakLeft  = 0.0f;
  mHoldPeakRight = 0.0f;
  mHoldCounter   = 0;
}

} // namespace SonicBridge
