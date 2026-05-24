"use client";

import { useState, useEffect, useRef } from "react";
import { useMaybeRoomContext } from "@livekit/components-react";
import { Track } from "livekit-client";

interface TrackStats {
  audioBitrate: number | null;
  videoBitrate: number | null;
  videoWidth: number | null;
  videoHeight: number | null;
  videoFps: number | null;
  screenShareBitrate: number | null;
  screenShareWidth: number | null;
  screenShareHeight: number | null;
  screenShareFps: number | null;
}

const EMPTY_STATS: TrackStats = {
  audioBitrate: null, videoBitrate: null,
  videoWidth: null, videoHeight: null, videoFps: null,
  screenShareBitrate: null, screenShareWidth: null, screenShareHeight: null, screenShareFps: null,
};

function computeDeltaBitrate(
  bytes: number, ts: number, prevBytesMap: Map<string, { bytes: number; ts: number }>, key: string,
): number | undefined {
  const prev = prevBytesMap.get(key);
  prevBytesMap.set(key, { bytes, ts });
  if (!prev) return undefined;
  const byteDelta = bytes - prev.bytes;
  const timeDelta = (ts - prev.ts) / 1000;
  if (timeDelta <= 0 || byteDelta < 0) return undefined;
  return Math.round((byteDelta * 8) / timeDelta);
}

function getPubSsrc(pub: unknown): number | undefined {
  const t = (pub as Record<string, unknown>).track;
  if (!t || typeof t !== "object") return undefined;
  return (t as Record<string, unknown>).info as number | undefined;
}

export function useTrackStats(participantIdentity: string): TrackStats {
  const room = useMaybeRoomContext();
  const [stats, setStats] = useState<TrackStats>(EMPTY_STATS);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevBytesRef = useRef<Map<string, { bytes: number; ts: number }>>(new Map());

  useEffect(() => {
    if (!room) return;
    const r = room;
    prevBytesRef.current = new Map();

    async function poll() {
      try {
        const isLocal = r.localParticipant?.identity === participantIdentity;
        const participant = isLocal ? r.localParticipant : r.remoteParticipants.get(participantIdentity);
        if (!participant) return;

        const audioSsrcs = new Set<number>();
        const videoSsrcs = new Set<number>();
        const screenSsrcs = new Set<number>();
        for (const [, pub] of participant.audioTrackPublications) {
          const ssrc = getPubSsrc(pub);
          if (ssrc !== undefined) audioSsrcs.add(ssrc);
        }
        for (const [, pub] of participant.videoTrackPublications) {
          const ssrc = getPubSsrc(pub);
          if (ssrc !== undefined) (pub.source === Track.Source.ScreenShare ? screenSsrcs : videoSsrcs).add(ssrc);
        }

        let pc: RTCPeerConnection | undefined;
        try {
          const eng = r.engine as unknown as Record<string, unknown>;
          pc = (isLocal ? eng.publisher : eng.subscriber) as RTCPeerConnection | undefined;
        } catch { return; }
        if (!pc || typeof pc.getStats !== "function") return;

        const report = await pc.getStats();
        const entryType = isLocal ? "outbound-rtp" : "inbound-rtp";
        const result: TrackStats = { ...EMPTY_STATS };

        for (const [, entry] of report) {
          if (entry.type !== entryType) continue;
          const e = entry as Record<string, unknown>;
          const ssrc = e.ssrc as number | undefined;
          if (ssrc === undefined) continue;
          const bytes = (e.bytesSent ?? e.bytesReceived) as number | undefined;
          const ts = e.timestamp as number | undefined;

          if (audioSsrcs.has(ssrc) && e.kind === "audio" && bytes !== undefined && ts !== undefined) {
            const br = computeDeltaBitrate(bytes, ts, prevBytesRef.current, `a-${ssrc}`);
            if (br !== undefined) result.audioBitrate = br;
          } else if (videoSsrcs.has(ssrc) && e.kind === "video") {
            if (bytes !== undefined && ts !== undefined) {
              const br = computeDeltaBitrate(bytes, ts, prevBytesRef.current, `v-${ssrc}`);
              if (br !== undefined) result.videoBitrate = br;
            }
            if (e.frameWidth !== undefined) result.videoWidth = e.frameWidth as number;
            if (e.frameHeight !== undefined) result.videoHeight = e.frameHeight as number;
            if (e.framesPerSecond !== undefined) result.videoFps = e.framesPerSecond as number;
          } else if (screenSsrcs.has(ssrc) && e.kind === "video") {
            if (bytes !== undefined && ts !== undefined) {
              const br = computeDeltaBitrate(bytes, ts, prevBytesRef.current, `s-${ssrc}`);
              if (br !== undefined) result.screenShareBitrate = br;
            }
            if (e.frameWidth !== undefined) result.screenShareWidth = e.frameWidth as number;
            if (e.frameHeight !== undefined) result.screenShareHeight = e.frameHeight as number;
            if (e.framesPerSecond !== undefined) result.screenShareFps = e.framesPerSecond as number;
          }
        }
        setStats(result);
      } catch { /* transient */ }
    }

    poll();
    intervalRef.current = setInterval(poll, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [room, participantIdentity]);
  return stats;
}
