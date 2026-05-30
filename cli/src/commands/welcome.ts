/**
 * First-run welcome banner. Mirrors the text from
 * docs/superpowers/specs/2026-05-27-cli-and-drag-drop-design.md
 * (Welcome banner section).
 */

export const WELCOME_TEXT = [
  "╔══════════════════════════════════════════════════════════╗",
  "║                  Welcome to SonicBridge CLI              ║",
  "╠══════════════════════════════════════════════════════════╣",
  "║  Manage Sonic Bridge project files, calendar events,     ║",
  "║  and discussion posts from your terminal — built for     ║",
  "║  humans and AI agents alike.                             ║",
  "║                                                          ║",
  "║  1. Generate a CLI token in Project Settings → CLI       ║",
  "║     Access on https://sonicbridge.app                    ║",
  "║  2. Run:  sonicbridge login                              ║",
  "║  3. Run:  sonicbridge --help                             ║",
  "╚══════════════════════════════════════════════════════════╝",
].join("\n");

export function printWelcomeBanner(
  stream: NodeJS.WriteStream = process.stdout,
): void {
  stream.write(WELCOME_TEXT + "\n");
}
