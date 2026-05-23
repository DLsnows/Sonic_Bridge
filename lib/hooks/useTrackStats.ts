"use client";

import { useState, useEffect, useRef } from "react";
import { useMaybeRoomContext } from "@livekit/components-react";

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

function collectSsrcs(
  participant: NonNullable<ReturnType<typeof import("@livekit/components-react").useMaybeRoomContext> extends { localParticipant?: infer L } ? L : never>,
): { audioSsrcs: Set<number>; videoSsrcs: Set<number>; screenSsrcs: Set<number> } {
  const audioSsrcs = new Set<number>();
  const videoSsrcs = new Set<number>();
  const screenSsrcs = new Set<number>();

  if (!participant) return { audioSsrcs, videoSsrcs, screenSsrcs };

  for (const [, pub] of participant.audioTrackPublications) {
    const ssrc = (pub as Record<string, unknown>).track?.info?.ssrc as number | undefined;
    if (ssrc) audioSsrcs.add(ssrc);
  }
  for (const [, pub] of participant.videoTrackPublications) {
    const ssrc = (pub as Record<string, unknown>).track?.info?.ssrc as number | undefined;
    if (!ssrc) continue;
    if (pub.source === 2 || (pub as Record<string, unknown>).track?.source === 2) {
      screenSsrcs.add(ssrc);
    } else {
      videoSsrcs.add(ssrc);
    }
  }

  return { audioSsrcs, videoSsrcs, screenSsrcs };
}

function parseRtpStats(
  stats: RTCStatsReport,
  ssrcs: { audioSsrcs: Set<number>; videoSsrcs: Set<number>; screenSsrcs: Set<number> },
  isLocal: boolean,
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
      if (e.bitrate !== undefined) audioBitrate = e.bitrate as number;
    } else if (ssrcs.videoSsrcs.has(ssrc)) {
      if (e.bitrate !== undefined) videoBitrate = e.bitrate as number;
      if (e.frameWidth !== undefined) videoWidth = e.frameWidth as number;
      if (e.frameHeight !== undefined) videoHeight = e.frameHeight as number;
      if (e.framesPerSecond !== undefined) videoFps = e.framesPerSecond as number;
    } else if (ssrcs.screenSsrcs.has(ssrc)) {
      if (e.bitrate !== undefined) screenShareBitrate = e.bitrate as number;
      if (!videoWidth && e.frameWidth !== undefined) {
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

  useEffect(() => {
    if (!room) return;

    async function poll() {
      try {
        const isLocal = room?.localParticipant?.identity === participantIdentity;
        const participant = isLocal
          ? room.localParticipant
          : room.remoteParticipants.get(participantIdentity);

        if (!participant) return;

        const ssrcs = collectSsrcs(participant);

        // Access publisher/subscriber peer connections via engine internals
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const eng = room.engine as unknown as Record<string, unknown>;
        const pc = isLocal
          ? (eng.publisher as Record<string, unknown> | undefined)?.peerConnection as RTCPeerConnection | undefined
          : (eng.subscriber as Record<string, unknown> | undefined)?.peerConnection as RTCPeerConnection | undefined;

        if (!pc || typeof pc.getStats !== "function") return;

        const statsReport = await pc.getStats();
        setStats(parseRtpStats(statsReport, ssrcs, isLocal));
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
