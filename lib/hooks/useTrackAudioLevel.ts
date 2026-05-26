"use client";

import { useEffect, useState } from "react";
import type { LocalAudioTrack, RemoteAudioTrack } from "livekit-client";

const FFT_SIZE = 1024;
// Visual decay rate (dB/sec) applied when current peak is lower than held value.
// Attack is instantaneous (any new peak >= current snaps up immediately).
const DECAY_DB_PER_SEC = 25;

let sharedCtx: AudioContext | null = null;
function getSharedAudioContext(): AudioContext {
  if (!sharedCtx || sharedCtx.state === "closed") {
    const ctx = new AudioContext();
    // Safari/Chrome may auto-suspend backgrounded tabs — re-resume on wake.
    ctx.addEventListener("statechange", () => {
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
    });
    sharedCtx = ctx;
  }
  if (sharedCtx.state === "suspended") {
    sharedCtx.resume().catch(() => {});
  }
  return sharedCtx;
}

/**
 * Returns a short-time peak dBFS level for a livekit audio track.
 * 0 dB = digital full-scale; -Infinity = silence; positive values are possible
 * when the source has post-gain headroom (e.g. mic gain > 1).
 */
export function useTrackAudioLevelDb(
  track: LocalAudioTrack | RemoteAudioTrack | undefined | null,
): number {
  const [db, setDb] = useState(-Infinity);

  const mst = track?.mediaStreamTrack;

  useEffect(() => {
    if (!track || !mst || mst.readyState !== "live") return;

    const ctx = getSharedAudioContext();
    const source = ctx.createMediaStreamSource(new MediaStream([mst]));
    const analyser = ctx.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    source.connect(analyser);

    const data = new Float32Array(analyser.fftSize);
    let smoothedDb = -Infinity;
    let lastTickMs = performance.now();
    let rafId: number | null = null;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      if (mst.readyState !== "live") {
        cancelled = true;
        return;
      }
      analyser.getFloatTimeDomainData(data);

      let peak = 0;
      for (let i = 0; i < data.length; i++) {
        const v = data[i];
        const a = v < 0 ? -v : v;
        if (a > peak) peak = a;
      }
      const newDb = peak > 0 ? 20 * Math.log10(peak) : -Infinity;

      const now = performance.now();
      const dtSec = Math.max(0, (now - lastTickMs) / 1000);
      lastTickMs = now;

      // Peak-meter ballistics: instant attack, linear-dB decay.
      if (newDb >= smoothedDb || !isFinite(smoothedDb)) {
        smoothedDb = newDb;
      } else {
        smoothedDb = Math.max(newDb, smoothedDb - DECAY_DB_PER_SEC * dtSec);
      }

      setDb(smoothedDb);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      try { source.disconnect(); } catch { /* already disconnected */ }
      try { analyser.disconnect(); } catch { /* already disconnected */ }
    };
  }, [track, mst]);

  return db;
}
