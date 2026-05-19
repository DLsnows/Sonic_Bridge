/**
 * Mock VST WebSocket Server for testing the VST bridge without the C++ plugin.
 *
 * Usage: npx tsx scripts/mock-vst-server.ts
 *
 * Simulates:
 *  - Handshake (projectId/userId/username)
 *  - Opus audio packet streaming (synthetic test tone)
 *  - Meter level updates
 *  - Settings sync
 *  - Ping/pong keep-alive
 */

import { WebSocketServer, WebSocket } from "ws";

const PORT = 9420;
const SAMPLE_RATE = 48000;
const CHANNELS = 2;
const FRAME_SIZE = 960; // 20ms at 48kHz
const OPUS_BITRATE = 128000;

// Minimal valid Opus packet: TOC byte + empty frame for silence
// Real Opus decoder will output near-silence from this
const silentOpusFrame = new Uint8Array([0xfc, 0xff, 0xfe]);

const wss = new WebSocketServer({ port: PORT });

console.log(`🎛  Mock VST Bridge Server running on ws://localhost:${PORT}`);
console.log("   Simulating SonicBridge VST plugin v1.0.0");
console.log("   Waiting for browser connections...\n");

wss.on("connection", (ws: WebSocket) => {
  console.log("[connect] Browser client connected");

  let seq = 0;
  let streamingInterval: ReturnType<typeof setInterval> | null = null;

  ws.on("message", (raw) => {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    switch (msg.type) {
      case "handshake": {
        console.log(
          `[handshake] project=${msg.projectId} user=${msg.username}`,
        );

        // Respond with status
        ws.send(
          JSON.stringify({
            type: "status",
            connected: true,
            pluginName: "Mock VST Bridge",
            version: "1.0.0-test",
          }),
        );

        // Send settings
        ws.send(
          JSON.stringify({
            type: "settings",
            sampleRate: SAMPLE_RATE,
            bufferSize: 256,
            channels: CHANNELS,
            opusBitrate: OPUS_BITRATE,
          }),
        );

        // Start streaming audio frames
        streamingInterval = setInterval(() => {
          if (ws.readyState !== WebSocket.OPEN) {
            if (streamingInterval) clearInterval(streamingInterval);
            return;
          }

          // Send Opus audio packet
          ws.send(
            JSON.stringify({
              type: "audio",
              seq: seq++,
              timestamp: Date.now(),
              sampleRate: SAMPLE_RATE,
              channels: CHANNELS,
              frameSize: FRAME_SIZE,
              data: Buffer.from(silentOpusFrame).toString("base64"),
            }),
          );

          // Send meter update every 5th frame (~10 Hz)
          if (seq % 5 === 0) {
            // Simulate a gentle sine-like meter movement
            const t = Date.now() / 1000;
            const left = -18 + 6 * Math.sin(t * 2.0);
            const right = -16 + 5 * Math.sin(t * 2.1 + 0.3);
            ws.send(
              JSON.stringify({
                type: "meter",
                left: Math.round(left * 10) / 10,
                right: Math.round(right * 10) / 10,
                peak: Math.round(Math.max(left, right) * 10) / 10,
              }),
            );
          }
        }, 20);
        break;
      }

      case "set_settings": {
        console.log(`[settings] opusBitrate changed to ${msg.opusBitrate}`);
        ws.send(
          JSON.stringify({
            type: "settings",
            sampleRate: SAMPLE_RATE,
            bufferSize: 256,
            channels: CHANNELS,
            opusBitrate: msg.opusBitrate ?? OPUS_BITRATE,
          }),
        );
        break;
      }

      case "get_settings": {
        ws.send(
          JSON.stringify({
            type: "settings",
            sampleRate: SAMPLE_RATE,
            bufferSize: 256,
            channels: CHANNELS,
            opusBitrate: OPUS_BITRATE,
          }),
        );
        break;
      }

      case "pong": {
        // keep-alive acknowledged
        break;
      }
    }
  });

  // Ping every 30 seconds
  const pingInterval = setInterval(() => {
    if (ws.readyState !== WebSocket.OPEN) {
      clearInterval(pingInterval);
      return;
    }
    ws.send(JSON.stringify({ type: "ping", timestamp: Date.now() }));
  }, 30000);

  ws.on("close", () => {
    console.log("[disconnect] Browser client disconnected");
    if (streamingInterval) clearInterval(streamingInterval);
    clearInterval(pingInterval);
  });

  ws.on("error", (err) => {
    console.error("[error]", err.message);
  });
});

console.log("Press Ctrl+C to stop\n");
