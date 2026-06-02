import * as jose from "jose";

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

  const secret = new TextEncoder().encode(apiSecret);

  const jwt = await new jose.SignJWT({
    name: participantName,
    metadata: JSON.stringify({ userId, username: participantName }),
    video: {
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
    },
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(apiKey)
    .setSubject(userId)
    .setJti(crypto.randomUUID())
    .setIssuedAt()
    .setExpirationTime("6h")
    .sign(secret);

  return jwt;
}
