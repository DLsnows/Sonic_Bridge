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
}

const EMPTY_STATS: TrackStats = {
  audioBitrate: null,
  videoBitrate: null,
  videoWidth: null,
  videoHeight: null,
  videoFps: null,
  screenShareBitrate: null,
};

interface ParticipantLike {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  audioTrackPublications: Map<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  videoTrackPublications: Map<string, any>;
}

function collectSsrcs(
  participant: ParticipantLike,
): { audioSsrcs: Set<number>; videoSsrcs: Set<number>; screenSsrcs: Set<number> } {
  const audioSsrcs = new Set<number>();
  const videoSsrcs = new Set<number>();
  const screenSsrcs = new Set<number>();

  for (const [, pub] of participant.audioTrackPublications) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ssrc = (pub as any)?.track?.info?.ssrc as number | undefined;
    if (ssrc) audioSsrcs.add(ssrc);
  }
  for (const [, pub] of participant.videoTrackPublications) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ssrc = (pub as any)?.track?.info?.ssrc as number | undefined;
    if (!ssrc) continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (pub.source === Track.Source.ScreenShare || (pub as any)?.track?.source === Track.Source.ScreenShare) {
      screenSsrcs.add(ssrc);
    } else {
      videoSsrcs.add(ssrc);
    }
  }

  return { audioSsrcs, videoSsrcs, screenSsrcs };
}

// Compute bitrate from bytesReceived/bytesSent delta between polls (cross-browser standard)
function extractBitrateFromBytes(
  e: Record<string, unknown>,
  prevBytesMap: Map<number, { bytes: number; ts: number }> | null,
  ssrc: number,
): number | undefined {
  // Prefer Chrome's non-standard bitrate field if available
  if (typeof e.bitrate === "number") return e.bitrate;

  // Fall back to bytes delta for Firefox/Safari compatibility
  const bytes = e.bytesReceived ?? e.bytesSent;
  const ts = e.timestamp;
  if (typeof bytes !== "number" || typeof ts !== "number" || !prevBytesMap) return undefined;

  const prev = prevBytesMap.get(ssrc);
  prevBytesMap.set(ssrc, { bytes, ts });

  if (!prev) return undefined;

  const byteDelta = bytes - prev.bytes;
  const timeDelta = (ts - prev.ts) / 1000; // ms → s
  if (timeDelta <= 0 || byteDelta < 0) return undefined;

  return Math.round((byteDelta * 8) / timeDelta); // bps
}

function parseRtpStats(
  stats: RTCStatsReport,
  ssrcs: { audioSsrcs: Set<number>; videoSsrcs: Set<number>; screenSsrcs: Set<number> },
  isLocal: boolean,
  prevBytesMap: Map<number, { bytes: number; ts: number }>,
): TrackStats {
  const entryType = isLocal ? "outbound-rtp" : "inbound-rtp";
  let audioBitrate: number | null = null;
  let videoBitrate: number | null = null;
  let videoWidth: number | null = null;
  let videoHeight: number | null = null;
  let videoFps: number | null = null;
  let screenShareBitrate: number | null = null;

  for (const [, entry] of stats) {
    if (entry.type !== entryType) continue;
    const e = entry as Record<string, unknown>;
    const ssrc = e.ssrc as number | undefined;
    if (ssrc === undefined) continue;

    if (ssrcs.audioSsrcs.has(ssrc)) {
      const br = extractBitrateFromBytes(e, prevBytesMap, ssrc);
      if (br !== undefined) audioBitrate = br;
    } else if (ssrcs.videoSsrcs.has(ssrc)) {
      const br = extractBitrateFromBytes(e, prevBytesMap, ssrc);
      if (br !== undefined) videoBitrate = br;
      if (e.frameWidth !== undefined) videoWidth = e.frameWidth as number;
      if (e.frameHeight !== undefined) videoHeight = e.frameHeight as number;
      if (e.framesPerSecond !== undefined) videoFps = e.framesPerSecond as number;
    } else if (ssrcs.screenSsrcs.has(ssrc)) {
      const br = extractBitrateFromBytes(e, prevBytesMap, ssrc);
      if (br !== undefined) screenShareBitrate = br;
      if (videoWidth === null && e.frameWidth !== undefined) {
        videoWidth = e.frameWidth as number;
        videoHeight = e.frameHeight as number;
        videoFps = e.framesPerSecond as number;
      }
    }
  }

  return { audioBitrate, videoBitrate, videoWidth, videoHeight, videoFps, screenShareBitrate };
}

export function useTrackStats(participantIdentity: string): TrackStats {
  const room = useMaybeRoomContext();
  const [stats, setStats] = useState<TrackStats>(EMPTY_STATS);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Track previous bytes for cross-browser bitrate computation
  const prevBytesRef = useRef<Map<number, { bytes: number; ts: number }>>(new Map());

  useEffect(() => {
    const currentRoom = room;
    if (!currentRoom) return;
    const r = currentRoom;
    // Reset byte deltas when room/identity changes
    prevBytesRef.current = new Map();

    async function poll() {
      try {
        const isLocal = r.localParticipant?.identity === participantIdentity;
        const participant = isLocal
          ? r.localParticipant
          : r.remoteParticipants.get(participantIdentity);

        if (!participant) return;

        const ssrcs = collectSsrcs(participant as unknown as ParticipantLike);

        // Try public API first (LiveKit 1.5+), fall back to engine internals
        let pc: RTCPeerConnection | undefined;
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const roomAny = r as any;
          if (typeof roomAny.getStats === "function") {
            // LiveKit 1.5+ public API — returns RTCStatsReport directly
            const report = await roomAny.getStats();
            setStats(parseRtpStats(report, ssrcs, isLocal, prevBytesRef.current));
            return;
          }
        } catch {
          // Fall through to engine internals
        }

        try {
          const eng = r.engine as unknown as Record<string, unknown>;
          pc = isLocal
            ? (eng.publisher as Record<string, unknown> | undefined)?.peerConnection as RTCPeerConnection | undefined
            : (eng.subscriber as Record<string, unknown> | undefined)?.peerConnection as RTCPeerConnection | undefined;
        } catch {
          setStats(EMPTY_STATS);
          return;
        }

        if (!pc || typeof pc.getStats !== "function") return;

        const statsReport = await pc.getStats();
        setStats(parseRtpStats(statsReport, ssrcs, isLocal, prevBytesRef.current));
      } catch {
        // Stats polling can fail transiently — ignore
      }
    }

    poll();
    intervalRef.current = setInterval(poll, 2000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [room, participantIdentity]);

  return stats;
}
