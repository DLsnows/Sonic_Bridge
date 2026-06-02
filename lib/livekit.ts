import * as jose from "jose";

// Generate a random UUID v4 string using Web Crypto API.
// Prefer crypto.randomUUID() when available (all modern runtimes),
// fall back to crypto.getRandomValues() for older edge isolates.
function randomUUID(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const arr = crypto.getRandomValues(new Uint8Array(16));
  arr[6] = (arr[6] & 0x0f) | 0x40; // version 4
  arr[8] = (arr[8] & 0x3f) | 0x80; // variant 10
  const hex = Array.from(arr).map(b => b.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
}

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
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime("6h")
    .sign(secret);

  return jwt;
}
