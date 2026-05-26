"use client";

import { useEffect, useRef, useState } from "react";
import type { LocalAudioTrack, RemoteAudioTrack } from "livekit-client";

const SMOOTHING = 0.3;
const FFT_SIZE = 256;

let sharedCtx: AudioContext | null = null;
function getSharedAudioContext(): AudioContext {
  if (!sharedCtx || sharedCtx.state === "closed") {
    sharedCtx = new AudioContext();
  }
  if (sharedCtx.state === "suspended") {
    sharedCtx.resume().catch(() => {});
  }
  return sharedCtx;
}

export function useTrackAudioLevel(
  track: LocalAudioTrack | RemoteAudioTrack | undefined | null,
): number {
  const [level, setLevel] = useState(0);
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  // Depend on both the livekit track wrapper AND the underlying MediaStreamTrack:
  // LiveKit may swap the MST on device-change/noise-mode-toggle without replacing
  // the wrapper, and without this dep the analyser would stay on the dead MST.
  const mst = track?.mediaStreamTrack;

  useEffect(() => {
    if (!track || !mst || mst.readyState !== "live") return;

    const ctx = getSharedAudioContext();
    const source = ctx.createMediaStreamSource(new MediaStream([mst]));
    const analyser = ctx.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = 0.4;
    source.connect(analyser);

    const data = new Uint8Array(analyser.fftSize);
    let smoothed = 0;
    let rafId: number | null = null;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      analyser.getByteTimeDomainData(data);
      let sumSq = 0;
      for (let i = 0; i < data.length; i++) {
        const n = (data[i] - 128) / 128;
        sumSq += n * n;
      }
      const rms = Math.sqrt(sumSq / data.length);
      smoothed = SMOOTHING * rms + (1 - SMOOTHING) * smoothed;
      if (mountedRef.current) setLevel(smoothed);
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

  return level;
}
