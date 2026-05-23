# SonicBridge VST Plugin

Captures DAW audio and streams it to the SonicBridge web client via local WebSocket.

## Audio Pipeline

```
DAW → SonicBridge VST (PCM float32) → WebSocket (localhost) → Browser → AudioWorklet → LiveKit Opus encode → Server
```

- **Buffer size:** The VST uses whatever buffer size your DAW provides. There is no manual buffer configuration — latency is determined by your DAW's audio settings.
- **Bitrate:** Audio quality is controlled in the browser's Audio Mixer panel (192-640 kbps Opus). This configures the LiveKit encoder — there is no encoding in the VST plugin itself.
- **Latency:** PCM is sent every audio block with no accumulation, providing the lowest possible latency.

## Prerequisites

- **CMake** 3.22+
- **Visual Studio 2022** (Windows) or **Xcode** (macOS)
- **JUCE 8.x** — https://github.com/juce-framework/JUCE
- **ixwebsocket** — `vcpkg install ixwebsocket` or `brew install ixwebsocket`

## Quick Start

```bash
# Clone or download JUCE
git clone https://github.com/juce-framework/JUCE.git

# Install dependencies (Windows via vcpkg)
vcpkg install ixwebsocket

# Configure
cmake -B build \
  -DJUCE_PATH=/path/to/JUCE \
  -DCMAKE_TOOLCHAIN_FILE=/path/to/vcpkg/scripts/buildsystems/vcpkg.cmake

# Build
cmake --build build --config Release
```

## Usage

1. Load the plugin on a stereo track in your DAW
2. Click "Start Bridge" — the plugin starts a WebSocket server on `localhost:9420` (auto-retries ports 9420-9429 if occupied)
3. The port is displayed in the plugin UI — enter this port in the browser's DAW Audio Bridge panel if auto-connect fails
4. Open the SonicBridge web app and navigate to a project's Creative Space
5. Audio is published to the LiveKit room for collaborators to hear

## Plugin UI

- **Status indicator:** Green = connected, Yellow = waiting, Gray = offline
- **Stereo meters:** Left/right channel peak metering with color thresholds (green/yellow/red) and peak hold line
- **Start/Stop bridge:** Manual control over the WebSocket server, shows actual port in use
- **Version:** Displayed in the bottom-right corner

## WebSocket Protocol

See `WebSocketProtocol.h` for JSON message type definitions. Audio is sent as binary frames:

- **Binary PCM frame:** 12-byte header (u32 sampleRate | u32 channels | u32 numSamples) + float32 interleaved data
- **Handshake:** browser sends project/user identity (JSON)
- **Meter:** dBFS level readings at ~20 Hz (JSON)
- **Status/Error:** Connection state updates (JSON)
