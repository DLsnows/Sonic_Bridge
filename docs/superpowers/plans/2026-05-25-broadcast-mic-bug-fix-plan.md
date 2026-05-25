# Broadcast Toggle Race + Mic Permanent Failure — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the broadcast off→on race that drops the DAW track and add diagnostics + defensive guards for the mic-permanent-silence bug.

**Architecture:** Three parallel sub-branches off `fix/creative-space-v8`, each touching disjoint files; merged back individually after their own internal checks pass. Diagnostic harness is purely additive (new files + one mount line). Fix branches do not depend on each other.

**Tech Stack:** Next.js (custom build — read `node_modules/next/dist/docs/` before touching anything Next-specific), React 19, livekit-client, `@livekit/components-react`, Zustand, AudioContext + AudioWorklet (Web Audio).

**Spec:** `docs/superpowers/specs/2026-05-25-broadcast-mic-bug-fix-design.md`

---

## Task 1 — Agent 1: Diagnostic harness

**Worktree:** `C:\Users\wang\claudeCode\sonicBridge0525\repo` (main, on branch `fix/creative-space-v8`)

**Files:**
- Create: `lib/dev-debug.ts`
- Create: `components/space/DevDebugPanel.tsx`
- Modify: `components/space/CreativeSpaceRoom.tsx` — one-line mount, dev-only

- [ ] **Step 1: Verify the worktree state**

```powershell
cd C:\Users\wang\claudeCode\sonicBridge0525\repo
git rev-parse --abbrev-ref HEAD   # expected: fix/creative-space-v8
git status --short                  # expected: empty (clean tree)
```

- [ ] **Step 2: Install dependencies**

```powershell
npm install
```

Expected: completes without errors. node_modules populated.

- [ ] **Step 3: Create `lib/dev-debug.ts`**

```ts
// Dev-only instrumentation for diagnosing audio/track state bugs.
// Mounted only in NODE_ENV === 'development'. Zero impact in prod.

import type { LocalParticipant, RemoteTrackPublication, LocalTrackPublication } from "livekit-client";
import { useVstStore } from "@/lib/store/vst";
import { useMediaSettingsStore } from "@/lib/store/media-settings";

let inited = false;
export function initDevDebug() {
  if (inited) return;
  inited = true;
  if (process.env.NODE_ENV !== "development") return;

  useVstStore.subscribe((s, prev) => {
    const changed: Record<string, unknown> = {};
    for (const k of Object.keys(s) as (keyof typeof s)[]) {
      if (s[k] !== prev[k]) changed[k as string] = { from: prev[k], to: s[k] };
    }
    if (Object.keys(changed).length) {
      // eslint-disable-next-line no-console
      console.log("[dev-debug][vstStore]", changed);
    }
  });

  useMediaSettingsStore.subscribe((s, prev) => {
    if (JSON.stringify(s) !== JSON.stringify(prev)) {
      // eslint-disable-next-line no-console
      console.log("[dev-debug][mediaSettings]", { audioQuality: s.audioQuality, dawAudio: s.dawAudio });
    }
  });
}

export interface PublicationSnapshot {
  source: string;
  sid: string | undefined;
  kind: string;
  trackId: string | undefined;
  muted: boolean | undefined;
  enabled: boolean | undefined;
  readyState: string | undefined;
}

export function snapshotPublications(lp: LocalParticipant): PublicationSnapshot[] {
  const out: PublicationSnapshot[] = [];
  lp.trackPublications.forEach((pub) => {
    const p = pub as LocalTrackPublication | RemoteTrackPublication;
    const t = p.track;
    out.push({
      source: p.source,
      sid: p.trackSid,
      kind: p.kind,
      trackId: t?.mediaStreamTrack?.id,
      muted: t?.mediaStreamTrack?.muted,
      enabled: t?.mediaStreamTrack?.enabled,
      readyState: t?.mediaStreamTrack?.readyState,
    });
  });
  return out;
}
```

- [ ] **Step 4: Create `components/space/DevDebugPanel.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useLocalParticipant } from "@livekit/components-react";
import { initDevDebug, snapshotPublications, type PublicationSnapshot } from "@/lib/dev-debug";

export function DevDebugPanel() {
  const { localParticipant } = useLocalParticipant();
  const [snap, setSnap] = useState<PublicationSnapshot[]>([]);
  const [open, setOpen] = useState(true);

  useEffect(() => { initDevDebug(); }, []);

  useEffect(() => {
    if (!localParticipant) return;
    const update = () => {
      const s = snapshotPublications(localParticipant);
      setSnap(s);
      // eslint-disable-next-line no-console
      console.log("[dev-debug][publications]", s);
    };
    update();
    const events: string[] = [
      "trackPublished", "trackUnpublished", "trackMuted", "trackUnmuted",
      "localTrackPublished", "localTrackUnpublished",
    ];
    for (const ev of events) {
      // @ts-expect-error event names dynamic
      localParticipant.on(ev, update);
    }
    const id = window.setInterval(update, 1500);
    return () => {
      for (const ev of events) {
        // @ts-expect-error event names dynamic
        localParticipant.off(ev, update);
      }
      window.clearInterval(id);
    };
  }, [localParticipant]);

  if (process.env.NODE_ENV !== "development") return null;
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{ position: "fixed", bottom: 8, right: 8, zIndex: 9999, padding: "4px 8px", fontSize: 10, background: "#000", color: "#0f0", border: "1px solid #0f0" }}
      >
        debug
      </button>
    );
  }
  return (
    <div style={{ position: "fixed", bottom: 8, right: 8, zIndex: 9999, width: 360, maxHeight: 260, overflow: "auto", padding: 8, background: "rgba(0,0,0,0.85)", color: "#0f0", fontFamily: "monospace", fontSize: 10, border: "1px solid #0f0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <strong>dev-debug · publications</strong>
        <button onClick={() => setOpen(false)} style={{ color: "#0f0", background: "transparent", border: 0, cursor: "pointer" }}>x</button>
      </div>
      {snap.length === 0 && <div>(no publications)</div>}
      {snap.map((p, i) => (
        <div key={i} style={{ borderTop: "1px dashed #044", paddingTop: 2, marginTop: 2 }}>
          <div>source={p.source} kind={p.kind}</div>
          <div>sid={p.sid ?? "-"}</div>
          <div>muted={String(p.muted)} enabled={String(p.enabled)} state={p.readyState ?? "-"}</div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Mount in `components/space/CreativeSpaceRoom.tsx`**

Add `import { DevDebugPanel } from "./DevDebugPanel";` near the top imports of `CreativeSpaceRoom.tsx`. Inside the rendered JSX of `CreativeSpaceRoom`, add `<DevDebugPanel />` at the same level as other children (e.g., next to `<ControlBar />`).

- [ ] **Step 6: Lint + typecheck**

```powershell
npm run lint
npx tsc --noEmit -p tsconfig.json
```

Expected: both pass with no errors / warnings.

- [ ] **Step 7: Write reproduction guide**

Create `docs/superpowers/diagnostics/2026-05-25-bug-b-repro.md` with:

1. Build + run dev: `npm run dev` and open the app in Chrome.
2. Open DevTools console + the on-screen `dev-debug · publications` panel.
3. Step sequence to capture: (a) join room; (b) toggle mic ON; (c) toggle broadcast ON; (d) confirm both work; (e) toggle broadcast OFF; (f) attempt to hear mic — expect silence; (g) capture the console log from step (a) onwards.
4. Paste console log back as a comment on the PR.

- [ ] **Step 8: Commit**

```powershell
git add lib/dev-debug.ts components/space/DevDebugPanel.tsx components/space/CreativeSpaceRoom.tsx docs/superpowers/diagnostics/2026-05-25-bug-b-repro.md
git commit -m "feat(dev): add dev-only debug panel for audio/track state diagnostics

Mounts a small floating panel in development mode that displays
local participant publication state (source, sid, muted, enabled,
readyState) and subscribes to Zustand store changes. Production
builds are unaffected (NODE_ENV gate).

See docs/superpowers/diagnostics/2026-05-25-bug-b-repro.md for
how to reproduce Bug B (mic permanent silence after broadcast)
and collect logs."
```

Done.

---

## Task 2 — Agent 2: Broadcast race fix

**Worktree:** `C:\Users\wang\claudeCode\sonicBridge0525\repo\.worktrees\broadcast-race-v8` (on branch `fix/broadcast-race-v8`)

**Files:**
- Modify: `lib/audio-pipeline.ts` — add `onReady` callback + synchronous publish-ready signaling
- Modify: `components/space/VstAudioBridge.tsx` — rewrite broadcast effect, remove PCM-callback publish

- [ ] **Step 1: Verify the worktree state**

```powershell
cd C:\Users\wang\claudeCode\sonicBridge0525\repo\.worktrees\broadcast-race-v8
git rev-parse --abbrev-ref HEAD   # expected: fix/broadcast-race-v8
git status --short                  # expected: empty
```

- [ ] **Step 2: Install dependencies**

```powershell
npm install
```

- [ ] **Step 3: Add `onReady` to `lib/audio-pipeline.ts`**

In the `VstAudioPipeline` class, add:

```ts
private readyCbs: Array<() => void> = [];

onReady(cb: () => void) {
  if (this.ready) {
    cb();
    return;
  }
  this.readyCbs.push(cb);
}
```

At the very end of `initialize()` (after `this.ready = true;`):

```ts
this.ready = true;
const cbs = this.readyCbs;
this.readyCbs = [];
for (const cb of cbs) cb();
```

In `shutdown()`, add at the top:

```ts
this.readyCbs = [];
```

- [ ] **Step 4: Rewrite broadcast effect in `components/space/VstAudioBridge.tsx`**

Replace the existing `useEffect` block (lines 55–89 of v7) with:

```ts
const pendingPublishRef = useRef(false);

useEffect(() => {
  // Disable path: synchronously clear ref so a rapid re-enable sees the cleared state.
  if (!broadcastEnabled) {
    const track = publishedTrackRef.current;
    if (track) {
      publishedTrackRef.current = null;
      useVstStore.getState().setAudioTrackPublished(false);
      participantRef.current.unpublishTrack(track).catch(() => {});
    }
    return;
  }

  // Enable path: publish when pipeline is ready. If not ready yet, queue via onReady.
  if (publishedTrackRef.current || pendingPublishRef.current) return;

  const tryPublish = () => {
    if (!useVstStore.getState().broadcastEnabled) {
      pendingPublishRef.current = false;
      return; // broadcast went off again while we waited — do nothing
    }
    const pipeline = pipelineRef.current;
    if (!pipeline?.isReady) return;
    const track = pipeline.refreshTrack();
    if (!track) {
      pendingPublishRef.current = false;
      return;
    }
    participantRef.current.publishTrack(track, {
      name: "DAW Audio (VST)",
      source: Track.Source.Unknown,
      audioBitrate: useMediaSettingsStore.getState().dawAudio.bitrate,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any).then(() => {
      publishedTrackRef.current = track;
      useVstStore.getState().setAudioTrackPublished(true);
    }).catch(() => {}).finally(() => {
      pendingPublishRef.current = false;
    });
  };

  pendingPublishRef.current = true;
  if (pipelineRef.current?.isReady) {
    tryPublish();
  } else if (pipelineRef.current) {
    pipelineRef.current.onReady(tryPublish);
  }
  // else: pipeline hasn't been created yet (no PCM received).
  // It will be created in the onPcmData callback below; that callback
  // calls onReady → tryPublish automatically (see Step 5).
}, [broadcastEnabled]);
```

- [ ] **Step 5: Remove publish branch from `onPcmData` callback and trigger `onReady`-driven publish on first PCM**

Inside the `bridge.onPcmData(...)` callback in `VstAudioBridge.tsx`, remove the entire block starting `// Publish DAW audio as independent channel (not Microphone)` (lines ~116–139 of v7). Replace it with: nothing — the callback ends after `pipeline.feedPcm(...)`.

Then, immediately after `pipelineRef.current = new VstAudioPipeline()` (when the pipeline is first created on first PCM), call its `initialize()` and after it resolves, if `useVstStore.getState().broadcastEnabled && !publishedTrackRef.current` then call the same `tryPublish` logic. Simplest: extract `tryPublish` to a closure outside the effect via a ref so the PCM callback can call it. Concrete code:

In the component body, add:
```ts
const tryPublishRef = useRef<() => void>(() => {});
```

Inside the broadcast effect, assign:
```ts
tryPublishRef.current = tryPublish;
```

In the PCM callback, replace the removed block with:
```ts
if (
  !publishedTrackRef.current &&
  !pendingPublishRef.current &&
  pipeline.isReady &&
  useVstStore.getState().broadcastEnabled
) {
  pendingPublishRef.current = true;
  pipeline.onReady(() => tryPublishRef.current());
}
```

(`onReady` is synchronous when already ready, so this triggers immediately on first PCM-after-init.)

- [ ] **Step 6: Lint + typecheck**

```powershell
npm run lint
npx tsc --noEmit -p tsconfig.json
```

Expected: both pass.

- [ ] **Step 7: Commit**

```powershell
git add lib/audio-pipeline.ts components/space/VstAudioBridge.tsx
git commit -m "fix(broadcast): eliminate off->on race + double-publish path

Two race conditions were causing DAW audio not to come back when
broadcast was re-enabled:

1. publishedTrackRef.current was cleared inside unpublishTrack.then(),
   so a rapid re-enable saw the ref still set and skipped re-publish.

2. The onPcmData callback had its own publish branch that competed
   with the broadcastEnabled effect's setTimeout-based publish,
   often publishing a stale destination's MediaStreamTrack.

Fix: single source of truth in the broadcast effect. Ref is cleared
synchronously before unpublishTrack runs. PCM callback only feeds
PCM and triggers the same tryPublish path via pipeline.onReady.
Pipeline now exposes an onReady() registration that fires once when
initialize() completes (or immediately if already ready)."
```

Done.

---

## Task 3 — Agent 3: Mic pipeline defensive guards

**Worktree:** `C:\Users\wang\claudeCode\sonicBridge0525\repo\.worktrees\mic-pipeline-guards-v8` (on branch `fix/mic-pipeline-guards-v8`)

**Files:**
- Modify: `lib/mic-pipeline.ts` — listen to context state / track events, expose `verifyAudioGraph`

- [ ] **Step 1: Verify the worktree state**

```powershell
cd C:\Users\wang\claudeCode\sonicBridge0525\repo\.worktrees\mic-pipeline-guards-v8
git rev-parse --abbrev-ref HEAD   # expected: fix/mic-pipeline-guards-v8
git status --short                  # expected: empty
```

- [ ] **Step 2: Install dependencies**

```powershell
npm install
```

- [ ] **Step 3: Add fields + listeners in `lib/mic-pipeline.ts`**

In the `MicPipeline` class fields, add:

```ts
private sourceTrack: MediaStreamTrack | null = null;
private contextStateUnsub: (() => void) | null = null;
private trackEventUnsubs: Array<() => void> = [];
```

At the end of `start()` (after `this._isRunning = true; this.startMeterLoop();`), add:

```ts
// Auto-resume if browser suspends the context (e.g., due to a competing AudioContext).
const ctx = this.audioContext!;
const onStateChange = () => {
  // eslint-disable-next-line no-console
  console.warn("[mic-pipeline] AudioContext state:", ctx.state);
  if (ctx.state === "suspended" && this._isRunning) {
    ctx.resume().catch(() => {});
  }
};
ctx.addEventListener("statechange", onStateChange);
this.contextStateUnsub = () => ctx.removeEventListener("statechange", onStateChange);

// Watch the underlying capture track for browser-driven mute / end.
this.sourceTrack = sourceTrack;
const onMute = () => { console.warn("[mic-pipeline] source track MUTED"); };
const onUnmute = () => { console.warn("[mic-pipeline] source track UNMUTED"); };
const onEnded = () => {
  console.error("[mic-pipeline] source track ENDED — pipeline broken");
};
sourceTrack.addEventListener("mute", onMute);
sourceTrack.addEventListener("unmute", onUnmute);
sourceTrack.addEventListener("ended", onEnded);
this.trackEventUnsubs.push(
  () => sourceTrack.removeEventListener("mute", onMute),
  () => sourceTrack.removeEventListener("unmute", onUnmute),
  () => sourceTrack.removeEventListener("ended", onEnded),
);
```

In `stop()`, before the `if (this.stream)` line, add:

```ts
this.contextStateUnsub?.();
this.contextStateUnsub = null;
for (const fn of this.trackEventUnsubs) fn();
this.trackEventUnsubs = [];
this.sourceTrack = null;
```

- [ ] **Step 4: Add `verifyAudioGraph()` method**

In the same class, after `setVolume`:

```ts
verifyAudioGraph(): { ok: boolean; reason?: string } {
  if (!this._isRunning) return { ok: false, reason: "not running" };
  if (!this.audioContext) return { ok: false, reason: "no audioContext" };
  if (this.audioContext.state !== "running") return { ok: false, reason: `audioContext state=${this.audioContext.state}` };
  if (!this.sourceNode || !this.gainNode || !this.destination) return { ok: false, reason: "graph nodes missing" };
  if (!this._processedTrack) return { ok: false, reason: "no processed track" };
  if (this._processedTrack.readyState !== "live") return { ok: false, reason: `processed track readyState=${this._processedTrack.readyState}` };
  if (this._processedTrack.muted) return { ok: false, reason: "processed track muted" };
  if (this.sourceTrack && this.sourceTrack.readyState !== "live") return { ok: false, reason: `source track readyState=${this.sourceTrack.readyState}` };
  if (this.sourceTrack?.muted) return { ok: false, reason: "source track muted" };
  return { ok: true };
}
```

- [ ] **Step 5: Lint + typecheck**

```powershell
npm run lint
npx tsc --noEmit -p tsconfig.json
```

Expected: both pass.

- [ ] **Step 6: Commit**

```powershell
git add lib/mic-pipeline.ts
git commit -m "fix(mic): add context-state + track-event listeners and verifyAudioGraph

Defensive guards for Bug B (mic permanently silent after co-active
with broadcast). Root cause is being diagnosed separately, but in
the meantime:

- Auto-resume the AudioContext if the browser auto-suspends it
  (most likely cause when a second AudioContext from the VST pipeline
  forces a sample-rate mismatch).
- Log mute/unmute/ended events on the source MediaStreamTrack so
  the diagnostic panel can correlate.
- Expose verifyAudioGraph() for the dev panel to call and surface
  why mic might be silent.

No behavioural change unless the context auto-suspends; logging is
warn-level only and benign in production."
```

Done.

---

## Task 4 — Integration

**Worktree:** `C:\Users\wang\claudeCode\sonicBridge0525\repo` (on branch `fix/creative-space-v8`)

- [ ] **Step 1: Wait for Agents 1, 2, 3 to finish**
- [ ] **Step 2: Merge `fix/broadcast-race-v8` into `fix/creative-space-v8`**

```powershell
cd C:\Users\wang\claudeCode\sonicBridge0525\repo
git merge --no-ff fix/broadcast-race-v8 -m "merge: broadcast off->on race fix"
```

- [ ] **Step 3: Merge `fix/mic-pipeline-guards-v8` into `fix/creative-space-v8`**

```powershell
git merge --no-ff fix/mic-pipeline-guards-v8 -m "merge: mic pipeline defensive guards"
```

- [ ] **Step 4: Verify**

```powershell
npm run lint
npx tsc --noEmit -p tsconfig.json
```

- [ ] **Step 5: Push and open PR**

```powershell
git push -u origin fix/creative-space-v8 fix/broadcast-race-v8 fix/mic-pipeline-guards-v8
gh pr create --repo DLsnows/Sonic_Bridge --base dev --head fix/creative-space-v8 --title "fix(v8): broadcast off->on race + mic defensive guards + dev debug panel" --body-file docs/superpowers/specs/2026-05-25-broadcast-mic-bug-fix-design.md
```

- [ ] **Step 6: Enter pr-review-loop** (do NOT auto-merge — user reviews and merges manually).
