#pragma once

#include <juce_core/juce_core.h>
#include <ixwebsocket/IXWebSocketServer.h>
#include <functional>
#include <mutex>
#include <vector>

namespace SonicBridge {

// Callbacks for incoming browser messages
struct VstBridgeCallbacks {
  std::function<void(const juce::String& projectId,
                     const juce::String& userId,
                     const juce::String& username)> onHandshake;
  std::function<void(int opusBitrate)> onBitrateChange;
  std::function<void()> onSettingsRequest;
};

class VstBridgeServer {
public:
  VstBridgeServer();
  ~VstBridgeServer();

  VstBridgeServer(const VstBridgeServer&) = delete;
  VstBridgeServer& operator=(const VstBridgeServer&) = delete;

  // Returns actual port bound, or -1 if all ports failed.
  // Tries `port` through `port + 9`.
  int start(int port = 9420);
  void stop();

  // Send messages to all connected clients
  void sendStatus(bool connected, const juce::String& pluginName,
                  const juce::String& version);

  // Send raw PCM to all connected clients as binary WebSocket frame.
  // Frame format: u32 sampleRate | u32 channels | u32 numSamples | float32 interleaved
  void sendPcmPacket(const float* interleaved, int numSamples,
                     int sampleRate, int channels);

  void sendMeterLevels(float left, float right, float peak);
  void sendSettings(int sampleRate, int bufferSize, int channels,
                    int opusBitrate);
  void sendError(const juce::String& code, const juce::String& message);

  bool isRunning() const { return mRunning; }
  int getClientCount() const;
  int getPort() const { return mPort; }

  VstBridgeCallbacks callbacks;

private:
  void onClientMessage(std::shared_ptr<ix::ConnectionState> connectionState,
                       ix::WebSocket& client,
                       const ix::WebSocketMessagePtr& msg);
  void broadcast(const juce::String& message);

  std::unique_ptr<ix::WebSocketServer> mServer;
  std::atomic<bool> mRunning{false};
  std::atomic<int> mPort{-1};
  mutable std::mutex mClientsMutex;
};

} // namespace SonicBridge
