#include "VstBridgeServer.h"
#include "WebSocketProtocol.h"

namespace SonicBridge {

VstBridgeServer::VstBridgeServer() = default;

VstBridgeServer::~VstBridgeServer() {
  stop();
}

bool VstBridgeServer::start(int port) {
  if (mRunning) return true;

  mServer = std::make_unique<ix::WebSocketServer>(port, "127.0.0.1");

  mServer->setOnClientMessageCallback(
    [this](std::shared_ptr<ix::WebSocket> client,
           const ix::WebSocketMessagePtr& msg) {
      onClientMessage(client, msg);
    }
  );

  auto res = mServer->listen();
  if (!res.first) {
    mServer.reset();
    return false;
  }

  mServer->start();
  mRunning = true;
  return true;
}

void VstBridgeServer::stop() {
  if (!mRunning) return;

  mRunning = false;

  if (mServer) {
    mServer->stop();
    mServer.reset();
  }

  std::lock_guard<std::mutex> lock(mClientsMutex);
  mClients.clear();
}

int VstBridgeServer::getClientCount() const {
  std::lock_guard<std::mutex> lock(mClientsMutex);
  return static_cast<int>(mClients.size());
}

void VstBridgeServer::onClientMessage(
    std::shared_ptr<ix::WebSocket> client,
    const ix::WebSocketMessagePtr& msg) {

  using namespace Protocol;

  if (msg->type == ix::WebSocketMessageType::Open) {
    std::lock_guard<std::mutex> lock(mClientsMutex);
    mClients.insert(client);
    return;
  }

  if (msg->type == ix::WebSocketMessageType::Close) {
    std::lock_guard<std::mutex> lock(mClientsMutex);
    mClients.erase(client);
    return;
  }

  if (msg->type == ix::WebSocketMessageType::Message) {
    auto json = parseMessage(msg->str);
    auto type = parseType(json["type"].toString());

    switch (type) {
      case MessageType::Handshake: {
        auto h = Handshake::fromJson(json);
        if (callbacks.onHandshake) {
          callbacks.onHandshake(h.projectId, h.userId, h.username);
        }
        break;
      }
      case MessageType::SetSettings: {
        auto s = SettingsMessage::fromJson(json);
        if (callbacks.onBitrateChange) {
          callbacks.onBitrateChange(s.opusBitrate);
        }
        break;
      }
      case MessageType::GetSettings: {
        if (callbacks.onSettingsRequest) {
          callbacks.onSettingsRequest();
        }
        break;
      }
      case MessageType::Pong:
        // keep-alive acknowledged
        break;
      default:
        break;
    }
  }
}

// -- Broadcast helpers --

void VstBridgeServer::broadcast(const juce::String& message) {
  std::lock_guard<std::mutex> lock(mClientsMutex);
  for (auto& client : mClients) {
    client->send(message.toStdString());
  }
}

void VstBridgeServer::sendStatus(bool connected,
                                  const juce::String& pluginName,
                                  const juce::String& version) {
  Protocol::StatusMessage msg{connected, pluginName, version};
  broadcast(Protocol::serialize(msg.toJson()));
}

void VstBridgeServer::sendAudioPacket(uint32_t seq, uint64_t timestamp,
                                       int sampleRate, int channels,
                                       int frameSize,
                                       const std::vector<uint8_t>& opusData) {
  Protocol::AudioMessage msg;
  msg.seq = seq;
  msg.timestamp = timestamp;
  msg.sampleRate = sampleRate;
  msg.channels = channels;
  msg.frameSize = frameSize;
  msg.opusData = opusData;
  broadcast(Protocol::serialize(msg.toJson()));
}

void VstBridgeServer::sendMeterLevels(float left, float right, float peak) {
  Protocol::MeterMessage msg{left, right, peak};
  broadcast(Protocol::serialize(msg.toJson()));
}

void VstBridgeServer::sendSettings(int sampleRate, int bufferSize,
                                    int channels, int opusBitrate) {
  Protocol::SettingsMessage msg{sampleRate, bufferSize, channels, opusBitrate};
  broadcast(Protocol::serialize(msg.toJson()));
}

void VstBridgeServer::sendError(const juce::String& code,
                                 const juce::String& message) {
  Protocol::ErrorMessage msg{code, message};
  broadcast(Protocol::serialize(msg.toJson()));
}

} // namespace SonicBridge
