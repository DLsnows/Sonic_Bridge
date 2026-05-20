// Gets an auth session cookie from the CI session endpoint.
// Usage: node scripts/lighthouse-login.mjs
// Set env: LHCI_BASE_URL

const BASE = process.env.LHCI_BASE_URL ?? "http://localhost:3000";

async function main() {
  const res = await fetch(`${BASE}/api/ci/session`);
  const setCookie = res.headers.getSetCookie?.() ?? [];

  const cookie = setCookie.find((c) => c.startsWith("authjs.session-token="));
  if (!cookie) {
    console.error("No session cookie returned. Set-Cookie:", setCookie);
    process.exit(1);
  }

  const cookieValue = cookie.split(";")[0];
  console.log(`cookie: ${cookieValue}`);
  process.exit(0);
}

main();
