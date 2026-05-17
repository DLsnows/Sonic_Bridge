import { AccessToken } from "livekit-server-sdk";

export async function getLiveKitToken(
  roomName: string,
  participantName: string,
  userId: string,
) {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error("LiveKit credentials not configured");
  }

  const token = new AccessToken(apiKey, apiSecret, {
    identity: userId,
    name: participantName,
    metadata: JSON.stringify({ userId, username: participantName }),
  });

  token.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
  });

  return token.toJwt();
}
