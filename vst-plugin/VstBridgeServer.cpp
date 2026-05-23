#include "VstBridgeServer.h"
#include "WebSocketProtocol.h"
#include <cstring>   // std::memcpy

namespace SonicBridge {

VstBridgeServer::VstBridgeServer() = default;

VstBridgeServer::~VstBridgeServer() {
  stop();
}

int VstBridgeServer::start(int port) {
  if (mRunning) return mPort;

  for (int offset = 0; offset < 10; ++offset) {
    int tryPort = port + offset;
    mServer = std::make_unique<ix::WebSocketServer>(tryPort, "127.0.0.1");

    mServer->setOnClientMessageCallback(
      [this](std::shared_ptr<ix::ConnectionState> connectionState,
             ix::WebSocket& client,
             const ix::WebSocketMessagePtr& msg) {
        onClientMessage(connectionState, client, msg);
      }
    );

    auto res = mServer->listen();
    if (res.first) {
      mServer->start();
      mRunning = true;
      mPort = tryPort;
      return tryPort;
    }
    mServer.reset();
  }

  mPort = -1;
  return -1;
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

void VstBridgeServer::sendPcmPacket(const float* interleaved, int numSamples,
                                     int sampleRate, int channels) {
  if (!mServer) return;

  // Pack header: 3 x u32 LE
  const int headerSize = 12;
  const int dataSize = numSamples * channels * static_cast<int>(sizeof(float));
  std::string frame(headerSize + dataSize, '\0');

  auto writeU32 = [&](int offset, uint32_t val) {
    frame[offset]     = static_cast<char>(val & 0xFF);
    frame[offset + 1] = static_cast<char>((val >> 8) & 0xFF);
    frame[offset + 2] = static_cast<char>((val >> 16) & 0xFF);
    frame[offset + 3] = static_cast<char>((val >> 24) & 0xFF);
  };

  writeU32(0, static_cast<uint32_t>(sampleRate));
  writeU32(4, static_cast<uint32_t>(channels));
  writeU32(8, static_cast<uint32_t>(numSamples));

  std::memcpy(&frame[headerSize], interleaved, dataSize);

  // Snapshot clients under lock
  std::vector<std::shared_ptr<ix::WebSocket>> snapshot;
  {
    std::lock_guard<std::mutex> lock(mClientsMutex);
    for (const auto& client : mServer->getClients()) {
      snapshot.push_back(client);
    }
  }

  for (auto& client : snapshot) {
    client->sendBinary(frame);
  }
}

} // namespace SonicBridge
