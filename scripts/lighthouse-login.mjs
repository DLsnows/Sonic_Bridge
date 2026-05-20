// Generates a valid Auth.js v5 JWT session cookie locally, without calling any API.
// Usage: node scripts/lighthouse-login.mjs
// Requires: AUTH_SECRET env var

import crypto from "node:crypto";

function base64url(buf) {
  return buf.toString("base64url");
}

function signHS256(data, secret) {
  return crypto.createHmac("sha256", secret).update(data).digest();
}

function encodeJWT(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const enc = (o) => base64url(Buffer.from(JSON.stringify(o)));
  const segments = [enc(header), enc(payload)].join(".");
  const sig = base64url(signHS256(Buffer.from(segments), Buffer.from(secret)));
  return `${segments}.${sig}`;
}

const secret = process.env.AUTH_SECRET;
if (!secret) {
  console.error("AUTH_SECRET not set");
  process.exit(1);
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
    exp: now + 3600,
    jti: crypto.randomUUID(),
  },
  secret,
);

console.log(`cookie: authjs.session-token=${token}`);
