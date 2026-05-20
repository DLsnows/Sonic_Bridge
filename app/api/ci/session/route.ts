import { NextResponse } from "next/server";
import crypto from "node:crypto";

// Only usable in CI. Generates a valid Auth.js v5 JWT session cookie
// so Lighthouse can test authenticated pages without real credentials.

function base64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function signHS256(data: Uint8Array, secret: Uint8Array): Buffer {
  return crypto.createHmac("sha256", secret).update(data).digest();
}

function encodeJWT(payload: Record<string, unknown>, secret: string): string {
  const header = { alg: "HS256", typ: "JWT" };
  const enc = (o: unknown) => base64url(Buffer.from(JSON.stringify(o)));

  const segments = [enc(header), enc(payload)].join(".");
  const sig = base64url(signHS256(Buffer.from(segments), Buffer.from(secret)));

  return `${segments}.${sig}`;
}

export async function GET() {
  if (process.env.CI !== "true") {
    return NextResponse.json({ error: "CI only" }, { status: 403 });
  }
  if (!process.env.AUTH_SECRET) {
    return NextResponse.json({ error: "No AUTH_SECRET" }, { status: 500 });
  }

  const now = Math.floor(Date.now() / 1000);
  const token = encodeJWT(
    {
      id: "ci-test",
      sub: "ci-test",
      username: "ci-test",
      email: "ci@test.local",
      name: "ci-test",
      picture: null,
      iat: now,
      exp: now + 3600, // 1 hour
      jti: crypto.randomUUID(),
    },
    process.env.AUTH_SECRET,
  );

  return NextResponse.json(
    { ok: true },
    {
      headers: {
        "Set-Cookie": `authjs.session-token=${token}; HttpOnly; SameSite=Lax; Path=/`,
      },
    },
  );
}
