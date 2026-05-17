#pragma once

#include <juce_core/juce_core.h>
#include <ixwebsocket/IXWebSocketServer.h>
#include <set>
#include <mutex>
#include <thread>
#include <functional>

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

  bool start(int port = 9420);
  void stop();

  // Send messages to all connected clients
  void sendStatus(bool connected, const juce::String& pluginName,
                  const juce::String& version);
  void sendAudioPacket(uint32_t seq, uint64_t timestamp, int sampleRate,
                       int channels, int frameSize,
                       const std::vector<uint8_t>& opusData);
  void sendMeterLevels(float left, float right, float peak);
  void sendSettings(int sampleRate, int bufferSize, int channels,
                    int opusBitrate);
  void sendError(const juce::String& code, const juce::String& message);

  bool isRunning() const { return mRunning; }
  int getClientCount() const;

  VstBridgeCallbacks callbacks;

private:
  void onClientMessage(std::shared_ptr<ix::WebSocket> client,
                       const ix::WebSocketMessagePtr& msg);
  void broadcast(const juce::String& message);

  std::unique_ptr<ix::WebSocketServer> mServer;
  std::set<std::shared_ptr<ix::WebSocket>> mClients;
  std::mutex mClientsMutex;
  std::atomic<bool> mRunning{false};
};

} // namespace SonicBridge
