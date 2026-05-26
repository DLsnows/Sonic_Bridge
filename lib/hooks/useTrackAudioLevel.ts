"use client";

import { useEffect, useState } from "react";
import type { LocalAudioTrack, RemoteAudioTrack } from "livekit-client";

const SMOOTHING = 0.3;
const FFT_SIZE = 256;

export function useTrackAudioLevel(
  track: LocalAudioTrack | RemoteAudioTrack | undefined | null,
): number {
  const [level, setLevel] = useState(0);

  useEffect(() => {
    if (!track) return;
    const mst = track.mediaStreamTrack;
    if (!mst || mst.readyState !== "live") return;

    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(new MediaStream([mst]));
    const analyser = ctx.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = 0.4;
    source.connect(analyser);

    const data = new Uint8Array(new ArrayBuffer(analyser.fftSize));
    let smoothed = 0;
    let rafId: number | null = null;
    let cancelled = false;

    const onState = () => {
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
    };
    ctx.addEventListener("statechange", onState);
    ctx.resume().catch(() => {});

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
      setLevel(smoothed);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      ctx.removeEventListener("statechange", onState);
      try { source.disconnect(); } catch { /* already disconnected */ }
      try { analyser.disconnect(); } catch { /* already disconnected */ }
      ctx.close().catch(() => {});
      setLevel(0);
    };
  }, [track]);

  return level;
}
