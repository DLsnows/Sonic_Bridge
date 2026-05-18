# SonicBridge

Real-time audio streaming bridge between a DAW (VST3 plugin) and the browser via WebSocket. The VST3 plugin captures audio from any DAW track, encodes it with Opus, and streams it through LiveKit to a Creative Space room.

## Architecture

```
DAW Track → SonicBridge VST3 Plugin (Opus Encode) → WebSocket (ws://127.0.0.1:9420)
                                                           ↓
                                                    Browser (Next.js)
                                                           ↓
                                                     LiveKit Room
```

## Project Structure

```
sonicbridge/
├── app/                    # Next.js App Router pages
├── components/             # React components (VstConnectionPanel, etc.)
├── lib/                    # WebSocket client, audio pipeline, Zustand store
├── public/
│   └── audio-worklet.js    # Audio decoding worklet (WebCodecs AudioDecoder)
├── scripts/
│   └── mock-vst-server.ts  # Mock WebSocket server for development
├── vst-plugin/             # C++ VST3 plugin (JUCE 8)
│   ├── CMakeLists.txt
│   └── *.cpp / *.h
└── package.json
```

## Quick Start (Web Development)

```bash
cp .env.example .env.local   # fill in LiveKit credentials
npm install
npm run mock-vst             # terminal 1: mock VST WebSocket server
npm run dev                  # terminal 2: Next.js dev server at http://localhost:3000
```

Open a Creative Space room. The VST Connection Panel will show "Connected" (green) when the mock server is running.

---

## VST3 Plugin

### Building from Source

**Prerequisites:**

| Dependency | Version | Install |
|------------|---------|---------|
| CMake | ≥ 3.22 | `winget install Kitware.CMake` |
| Visual Studio 2022 | Build Tools | `winget install Microsoft.VisualStudio.2022.BuildTools` |
| vcpkg | latest | `git clone https://github.com/Microsoft/vcpkg.git C:\dev\vcpkg` |
| JUCE | 8.0+ | Download from [juce.com](https://juce.com) |

**Step 1 — Install vcpkg dependencies:**

```powershell
cd C:\dev\vcpkg
.\vcpkg install opus:x64-windows ixwebsocket:x64-windows openssl:x64-windows
```

**Step 2 — Configure and build:**

```powershell
cd sonicbridge\vst-plugin
mkdir build; cd build

cmake .. -G "Visual Studio 17 2022" -A x64 `
  -DCMAKE_TOOLCHAIN_FILE="C:/dev/vcpkg/scripts/buildsystems/vcpkg.cmake" `
  -DJUCE_PATH="C:/path/to/JUCE" `
  -DVCPKG_INSTALLED="C:/dev/vcpkg/installed/x64-windows"

cmake --build . --config Release
```

The VST3 bundle is created at:
```
build\SonicBridgeVST_artefacts\Release\VST3\SonicBridge VST.vst3\
```

**Build options:**

| Option | Default | Description |
|--------|---------|-------------|
| `JUCE_PATH` | (required) | Path to JUCE root directory |
| `VCPKG_INSTALLED` | auto-detect | vcpkg installed triplet path. Auto-detected from toolchain file; override if your vcpkg is at a non-standard location |

### Installing in a DAW

VST3 plugins follow the Steinberg VST3 bundle convention. Plugins are discovered from the **system VST3 directory**, not arbitrary folders.

**Install location:**

| Platform | Path |
|----------|------|
| Windows | `C:\Program Files\Common Files\VST3\` |
| macOS | `~/Library/Audio/Plug-Ins/VST3/` or `/Library/Audio/Plug-Ins/VST3/` |

**Install steps:**

1. Copy the **entire** `SonicBridge VST.vst3` folder (the bundle) into the system VST3 directory:

```powershell
# Windows — copy from build output
Copy-Item -Recurse `
  "vst-plugin\build\SonicBridgeVST_artefacts\Release\VST3\SonicBridge VST.vst3" `
  -Destination "C:\Program Files\Common Files\VST3\SonicBridge VST.vst3"
```

2. Launch your DAW and re-scan plugins. The plugin will appear under the category **Fx | Analyzer** (metering/analysis plugins).

### VST3 Bundle Contents

The `.vst3` bundle is a folder containing everything the plugin needs:

```
SonicBridge VST.vst3/
└── Contents/
    ├── Resources/
    │   └── moduleinfo.json          # VST3 metadata
    └── x86_64-win/
        ├── SonicBridge VST.vst3     # plugin binary
        ├── opus.dll                 # Opus audio encoder
        ├── z.dll                    # zlib (Opus dependency)
        ├── libcrypto-3-x64.dll      # OpenSSL cryptography
        └── libssl-3-x64.dll         # OpenSSL TLS
```

All DLLs are **self-contained** within the bundle — no external PATH setup needed.

### How It Works

1. **Load the plugin** on any DAW track (master bus recommended for full mix monitoring).
2. The plugin starts a **WebSocket server** on `ws://127.0.0.1:9420`.
3. Open the SonicBridge web app and navigate to a **Creative Space** room.
4. The browser connects to the plugin's WebSocket server.
5. Audio flows: **DAW → Plugin (Opus encode) → WebSocket → Browser (AudioDecoder) → LiveKit Room**.

### Plugin Parameters

| Parameter | Range | Default | Description |
|-----------|-------|---------|-------------|
| Opus Bitrate | 16–512 kbps | 128 | Audio encoding quality/bandwidth |

The bitrate can be adjusted from the DAW's plugin parameter panel or remotely from the browser (the browser sends a `set_settings` message).

### Testing Without a DAW

During development, use the mock server instead of the real plugin:

```bash
npm run mock-vst
```

This starts a WebSocket server on port 9420 that simulates the VST3 plugin — sends fake status messages, meter levels, and settings. The browser-side code behaves identically whether connected to the real plugin or the mock server.

### WebSocket Protocol

The plugin and browser communicate via a JSON-based protocol over WebSocket. See [WebSocketProtocol.h](vst-plugin/WebSocketProtocol.h) for the complete message schema.

| Message Type | Direction | Description |
|-------------|-----------|-------------|
| `handshake` | Browser → Plugin | Authenticate with project/user ID |
| `status` | Plugin → Browser | Connection state, plugin name/version |
| `audio` | Plugin → Browser | Opus-encoded audio packet (Base64) |
| `meter` | Plugin → Browser | Volume meter levels (L/R/peak in dBFS) |
| `settings` | Plugin → Browser | Current plugin settings |
| `set_settings` | Browser → Plugin | Change settings (e.g., bitrate) |
| `get_settings` | Browser → Plugin | Request current settings |
| `ping` / `pong` | Bidirectional | Keep-alive |
| `error` | Plugin → Browser | Error message |
| `disconnect` | Plugin → Browser | Server shutting down |

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `AUTH_SECRET` | Yes | — | NextAuth.js secret for session signing |
| `LIVEKIT_API_KEY` | Yes | — | LiveKit Server API key |
| `LIVEKIT_API_SECRET` | Yes | — | LiveKit Server API secret |
| `LIVEKIT_URL` | Yes | `ws://localhost:7880` | LiveKit server WebSocket URL |
| `VST_WS_PORT` | No | `9420` | VST plugin WebSocket server port |

Copy `.env.example` to `.env.local` and fill in your credentials before running the dev server.
