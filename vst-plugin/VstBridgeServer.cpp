#include "VstBridgeServer.h"
#include "WebSocketProtocol.h"
#include <cstring>

namespace SonicBridge {

VstBridgeServer::VstBridgeServer() = default;

VstBridgeServer::~VstBridgeServer() {
  stop();
}

bool VstBridgeServer::start(int port) {
  if (mRunning) return true;

  mServer = std::make_unique<ix::WebSocketServer>(port, "127.0.0.1");

  mServer->setOnClientMessageCallback(
    [this](std::shared_ptr<ix::ConnectionState> connectionState,
           ix::WebSocket& client,
           const ix::WebSocketMessagePtr& msg) {
      onClientMessage(connectionState, client, msg);
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
}

int VstBridgeServer::getClientCount() const {
  if (!mServer) return 0;
  std::lock_guard<std::mutex> lock(mClientsMutex);
  return static_cast<int>(mServer->getClients().size());
}

void VstBridgeServer::onClientMessage(
    std::shared_ptr<ix::ConnectionState> /*connectionState*/,
    ix::WebSocket& /*client*/,
    const ix::WebSocketMessagePtr& msg) {

  using namespace Protocol;

  // Connection lifecycle events need no handling here —
  // client counting and broadcast use mServer->getClients() directly
  if (msg->type == ix::WebSocketMessageType::Open ||
      msg->type == ix::WebSocketMessageType::Close) {
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
  if (!mServer) return;

  // Snapshot clients under lock to minimize contention on the audio thread.
  // shared_ptr keeps each WebSocket alive; send() is thread-safe and a
  // no-op on closed sockets, so iterating outside the lock is safe.
  std::vector<std::shared_ptr<ix::WebSocket>> snapshot;
  {
    std::lock_guard<std::mutex> lock(mClientsMutex);
    for (const auto& client : mServer->getClients()) {
      snapshot.push_back(client);
    }
  }

  for (auto& client : snapshot) {
    client->send(message.toStdString());
  }
}

void VstBridgeServer::broadcastBinary(const std::vector<uint8_t>& data) {
  if (!mServer || data.empty()) return;

  std::vector<std::shared_ptr<ix::WebSocket>> snapshot;
  {
    std::lock_guard<std::mutex> lock(mClientsMutex);
    for (const auto& client : mServer->getClients()) {
      snapshot.push_back(client);
    }
  }

  for (auto& client : snapshot) {
    client->sendBinary(ix::IXWebSocketSendData(data));
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

void VstBridgeServer::sendPcmPacket(const float* interleavedSamples,
                                     int numSamples,
                                     int sampleRate,
                                     int channels) {
  if (!mServer) return;

  // Binary PCM frame format:
  // [4B magic "SBPC"][4B uint32 numSamples][4B uint32 sampleRate][2B uint16 channels]
  // [numSamples * channels * 4B: float32 PCM]
  const int headerSize = 4 + 4 + 4 + 2;
  const int dataSize = numSamples * channels * static_cast<int>(sizeof(float));
  std::vector<uint8_t> packet(static_cast<size_t>(headerSize + dataSize));

  // Magic
  packet[0] = 'S'; packet[1] = 'B'; packet[2] = 'P'; packet[3] = 'C';

  // numSamples (uint32 LE)
  auto u32 = static_cast<uint32_t>(numSamples);
  packet[4] = static_cast<uint8_t>(u32 & 0xff);
  packet[5] = static_cast<uint8_t>((u32 >> 8) & 0xff);
  packet[6] = static_cast<uint8_t>((u32 >> 16) & 0xff);
  packet[7] = static_cast<uint8_t>((u32 >> 24) & 0xff);

  // sampleRate (uint32 LE)
  auto sr = static_cast<uint32_t>(sampleRate);
  packet[8] = static_cast<uint8_t>(sr & 0xff);
  packet[9] = static_cast<uint8_t>((sr >> 8) & 0xff);
  packet[10] = static_cast<uint8_t>((sr >> 16) & 0xff);
  packet[11] = static_cast<uint8_t>((sr >> 24) & 0xff);

  // channels (uint16 LE)
  auto ch = static_cast<uint16_t>(channels);
  packet[12] = static_cast<uint8_t>(ch & 0xff);
  packet[13] = static_cast<uint8_t>((ch >> 8) & 0xff);

  // PCM float32 data
  std::memcpy(packet.data() + headerSize, interleavedSamples,
              static_cast<size_t>(dataSize));

  broadcastBinary(packet);
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
