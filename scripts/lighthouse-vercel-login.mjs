// Logs into the deployed app via the /login form and prints the
// auth cookie header (name=value pairs joined with "; ") to stdout.
// Stdout is consumed by the workflow; all diagnostics go to stderr.
//
// Env: BASE_URL, LIGHTHOUSE_EMAIL, LIGHTHOUSE_PASSWORD

import { chromium } from "playwright";

const baseUrl = process.env.BASE_URL?.replace(/\/$/, "");
const email = process.env.LIGHTHOUSE_EMAIL;
const password = process.env.LIGHTHOUSE_PASSWORD;

if (!baseUrl || !email || !password) {
  console.error("Missing BASE_URL / LIGHTHOUSE_EMAIL / LIGHTHOUSE_PASSWORD");
  process.exit(1);
}

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();

page.on("console", (msg) => console.error(`[browser:${msg.type()}] ${msg.text()}`));
page.on("pageerror", (err) => console.error(`[browser:error] ${err.message}`));

console.error(`Navigating to ${baseUrl}/login`);
const initialResp = await page.goto(`${baseUrl}/login`, {
  waitUntil: "domcontentloaded",
  timeout: 60_000,
});
console.error(`GET /login -> ${initialResp?.status()} (final URL: ${page.url()})`);

await page.fill("#email", email);
await page.fill("#password", password);

// Capture the credentials-callback response so we know whether the server
// accepted or rejected the login regardless of how the client navigates.
const callbackPromise = page
  .waitForResponse(
    (r) =>
      r.url().includes("/api/auth/callback/credentials") &&
      r.request().method() === "POST",
    { timeout: 30_000 },
  )
  .catch((e) => {
    console.error(`No credentials-callback response observed: ${e.message}`);
    return null;
  });

await page.click('button[type="submit"]');
const callbackResp = await callbackPromise;
if (callbackResp) {
  console.error(`POST /api/auth/callback/credentials -> ${callbackResp.status()}`);
  const location = callbackResp.headers()["location"];
  if (location) console.error(`  Location: ${location}`);
}

// Give the client a moment to receive the cookie / redirect.
await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
await page.waitForTimeout(1500);
console.error(`Post-submit URL: ${page.url()}`);

// If we're still on /login, surface any inline error message before bailing.
if (new URL(page.url()).pathname.startsWith("/login")) {
  const errText = await page
    .locator('p:has-text("Invalid email or password"), p.text-\\[\\#FF4444\\]')
    .first()
    .textContent({ timeout: 1_000 })
    .catch(() => null);
  if (errText) console.error(`Login form error: ${errText.trim()}`);
}

const cookies = await ctx.cookies(baseUrl);
const authCookies = cookies.filter(
  (c) => c.name.includes("authjs") || c.name.includes("next-auth"),
);
const sessionCookies = authCookies.filter((c) => c.name.includes("session-token"));

if (sessionCookies.length === 0) {
  console.error(
    `No session cookie found. All cookies on ${baseUrl}: ${cookies
      .map((c) => c.name)
      .join(", ")}`,
  );
  await browser.close();
  process.exit(1);
}

// Send session cookie(s); CSRF cookies aren't needed for browsing.
const header = sessionCookies.map((c) => `${c.name}=${c.value}`).join("; ");
console.error(`Captured ${sessionCookies.length} session cookie(s): ${sessionCookies.map((c) => c.name).join(", ")}`);
process.stdout.write(header);

await browser.close();
