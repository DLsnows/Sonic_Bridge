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

// Vercel marks a preview "Ready" before the serverless functions have warm
// DB connections, so a cold call to /api/auth/callback/credentials sometimes
// returns "Invalid email or password" even with correct creds. Retry a few
// times with backoff before giving up.
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 10_000;

let header = null;
for (let attempt = 1; attempt <= MAX_ATTEMPTS && !header; attempt++) {
  console.error(`\n--- Login attempt ${attempt}/${MAX_ATTEMPTS} ---`);
  header = await tryLogin();
  if (!header && attempt < MAX_ATTEMPTS) {
    console.error(`Sleeping ${RETRY_DELAY_MS / 1000}s before retry…`);
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
  }
}

await browser.close();

if (!header) {
  console.error(`Login failed after ${MAX_ATTEMPTS} attempts.`);
  process.exit(1);
}
process.stdout.write(header);

async function tryLogin() {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on("console", (msg) => console.error(`[browser:${msg.type()}] ${msg.text()}`));
  page.on("pageerror", (err) => console.error(`[browser:error] ${err.message}`));

  try {
    console.error(`Navigating to ${baseUrl}/login`);
    const initialResp = await page.goto(`${baseUrl}/login`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    console.error(`GET /login -> ${initialResp?.status()} (final URL: ${page.url()})`);

    await page.fill("#email", email);
    await page.fill("#password", password);

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

    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(1_500);
    console.error(`Post-submit URL: ${page.url()}`);

    if (new URL(page.url()).pathname.startsWith("/login")) {
      const errText = await page
        .locator('p:has-text("Invalid email or password"), p.text-\\[\\#FF4444\\]')
        .first()
        .textContent({ timeout: 1_000 })
        .catch(() => null);
      if (errText) console.error(`Login form error: ${errText.trim()}`);
    }

    const cookies = await ctx.cookies(baseUrl);
    const sessionCookies = cookies.filter(
      (c) => c.name.includes("authjs") && c.name.includes("session-token"),
    );

    if (sessionCookies.length === 0) {
      console.error(
        `No session cookie found. Cookies on ${baseUrl}: ${cookies.map((c) => c.name).join(", ")}`,
      );
      return null;
    }

    console.error(
      `Captured ${sessionCookies.length} session cookie(s): ${sessionCookies.map((c) => c.name).join(", ")}`,
    );
    return sessionCookies.map((c) => `${c.name}=${c.value}`).join("; ");
  } finally {
    await ctx.close();
  }
}
