# SonicBridge VST Plugin

Captures DAW audio and streams it to the SonicBridge web client via local WebSocket.

## Prerequisites

- **CMake** 3.22+
- **Visual Studio 2022** (Windows) or **Xcode** (macOS)
- **JUCE 8.x** — https://github.com/juce-framework/JUCE
- **libopus** — `vcpkg install opus` or `brew install opus`
- **ixwebsocket** — `vcpkg install ixwebsocket` or `brew install ixwebsocket`
- **OpenSSL** — required by ixwebsocket

## Quick Start

```bash
# Clone or download JUCE
git clone https://github.com/juce-framework/JUCE.git

# Install dependencies (Windows via vcpkg)
vcpkg install opus ixwebsocket openssl

# Configure
cmake -B build \
  -DJUCE_PATH=/path/to/JUCE \
  -DCMAKE_TOOLCHAIN_FILE=/path/to/vcpkg/scripts/buildsystems/vcpkg.cmake

# Build
cmake --build build --config Release
```

## Usage

1. Load the plugin on a stereo track in your DAW
2. Open the SonicBridge web app and navigate to a project's Creative Space
3. The plugin starts a WebSocket server on `localhost:9420`
4. The browser connects automatically and begins receiving audio
5. Audio is published to the LiveKit room for collaborators to hear

## Architecture

```
DAW Audio → PluginProcessor::processBlock()
    → AudioMeter (peak/RMS)
    → AudioEncoder (Opus)
    → VstBridgeServer (WebSocket on localhost:9420)
    → Browser (VstBridge client)
    → LiveKit Room
```

## Plugin UI

- **Status indicator:** Green = connected, Yellow = waiting, Gray = offline
- **Stereo meters:** Left/right channel peak/RMS metering
- **Bitrate control:** Adjustable Opus bitrate (32–320 kbps)
- **Start/Stop bridge:** Manual control over the WebSocket server

## WebSocket Protocol

See `WebSocketProtocol.h` for message type definitions. The protocol is JSON-based with:
- **Handshake:** browser sends project/user identity
- **Audio:** base64-encoded Opus packets (20ms frames)
- **Meter:** dBFS level readings (20 Hz)
- **Settings:** sample rate, buffer size, bitrate sync
