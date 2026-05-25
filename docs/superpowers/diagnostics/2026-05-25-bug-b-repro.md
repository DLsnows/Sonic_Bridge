# Bug B Reproduction Guide — Mic Permanent Silence After Broadcast Co-Active

**Date:** 2026-05-25
**Spec:** `docs/superpowers/specs/2026-05-25-broadcast-mic-bug-fix-design.md`
**Plan:** `docs/superpowers/plans/2026-05-25-broadcast-mic-bug-fix-plan.md`

## Symptom

After the microphone and the "Broadcast to Room" toggle have both been
enabled at the same time, then "Broadcast to Room" is disabled, the
microphone stops producing audio for other participants. The UI still
shows the mic as ON. A page reload restores the microphone.

## Prerequisites

- A Vercel preview deployment of the `fix/creative-space-v8` branch
  (Vercel auto-builds one when the branch is pushed). The dev-debug
  panel is gated by `?debug=1` in the URL — open the preview with
  that query string to activate it.
- Two browser sessions (or two devices): one is the "subject" running
  the buggy local mic + broadcast; the other is the "listener" who
  confirms whether the subject's mic audio is reaching the room.
- VST plugin or any DAW source capable of feeding PCM into the VST
  bridge so "Broadcast to Room" has audio to publish.

## Step-by-step

1. **Open the Vercel preview with `?debug=1`:**

   Use the preview URL printed by Vercel for the PR, append
   `?debug=1` to it (e.g. `https://sonic-bridge-git-fix-creative-space-v8-…vercel.app/projects/…?debug=1`).

2. **Open DevTools console** (F12 → Console tab). You should see logs
   prefixed with `[dev-debug]` once the room is joined. Also confirm
   the on-screen `dev-debug · publications` panel is visible in the
   bottom-right corner. (If you don't see the panel, you forgot the
   `?debug=1` — the panel does NOT render without it on Vercel.)

3. **Join the Creative Space room** as the subject. Wait for the
   LiveKit connection to settle (state `connected`).

4. **Toggle the microphone ON.** Confirm:
   - The mic button visibly enters its "on" state.
   - The listener can hear you.
   - The dev-debug panel shows a publication with `source=microphone`,
     `muted=false`, `enabled=true`, `state=live`.

5. **Start the DAW connection and toggle "Broadcast to Room" ON.**
   Confirm:
   - The dev-debug panel shows two publications: one `microphone` and
     one with `source=unknown` (the DAW audio). Both should be `live`
     and not `muted`.
   - The listener can hear both your mic and the DAW audio.

6. **Toggle "Broadcast to Room" OFF.** Confirm:
   - The dev-debug panel now shows only the `microphone` publication.
   - The listener checks: is your mic audio still arriving?

7. **The bug:** the listener reports silence on the subject's mic even
   though the subject's UI shows the mic is still ON. The dev-debug
   panel may show `muted=true` on the `microphone` publication, or
   `enabled=false`, or `state` other than `live`. Whichever fields
   changed are the diagnostic signal.

8. **Capture the full console log** from step 3 onwards (right-click
   the Console → "Save as…" or use the Copy All button). Capture the
   final state of the dev-debug panel as a screenshot.

9. **Paste the console log + screenshot as a comment on the PR** for
   `fix/creative-space-v8`. Format the log as a fenced code block.

## What to look for in the log

The key `[dev-debug]` lines after step 6 (broadcast OFF):

- `[dev-debug][vstStore]` — did `broadcastEnabled` go from `true` to
  `false`? Did `audioTrackPublished` follow? Did anything unexpected
  also change?
- `[dev-debug][publications]` — the microphone publication's
  `muted`/`enabled`/`readyState` immediately before and after the
  broadcast toggle.
- `[mic-pipeline]` warnings — once Agent 3's defensive guards land,
  these will tell us if the `AudioContext` auto-suspended or if the
  source `MediaStreamTrack` fired `mute`/`ended`.

These three correlated signals will pinpoint which of the four
candidate root causes in the design spec is the real one.

## Quick reset between runs

A page reload restores the mic. Use that between attempts (keep
`?debug=1` in the URL when reloading). Do not forget to also stop and
restart the DAW side, otherwise the second broadcast cycle may start
from a different baseline.
