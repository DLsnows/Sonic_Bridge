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

console.error(`Navigating to ${baseUrl}/login`);
await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });

await page.fill("#email", email);
await page.fill("#password", password);

await Promise.all([
  page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 }),
  page.click('button[type="submit"]'),
]);

const cookies = await ctx.cookies(baseUrl);
const authCookies = cookies.filter(
  (c) => c.name.includes("authjs") || c.name.includes("next-auth"),
);

if (authCookies.length === 0) {
  console.error("No auth cookies found. Saw:", cookies.map((c) => c.name));
  await browser.close();
  process.exit(1);
}

const header = authCookies.map((c) => `${c.name}=${c.value}`).join("; ");
console.error(`Captured ${authCookies.length} auth cookie(s)`);
process.stdout.write(header);

await browser.close();
