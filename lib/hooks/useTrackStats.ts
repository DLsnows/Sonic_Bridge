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

// Cross-browser bitrate: prefer Chrome's non-standard bitrate, fall back to bytes delta
function extractBitrateFromBytes(
  e: Record<string, unknown>,
  prevBytesMap: Map<string, { bytes: number; ts: number }> | null,
  trackKey: string,
): number | undefined {
  if (typeof e.bitrate === "number") return e.bitrate;

  const bytes = e.bytesReceived ?? e.bytesSent;
  const ts = e.timestamp;
  if (typeof bytes !== "number" || typeof ts !== "number" || !prevBytesMap) return undefined;

  const prev = prevBytesMap.get(trackKey);
  prevBytesMap.set(trackKey, { bytes, ts });

  if (!prev) return undefined;

  const byteDelta = bytes - prev.bytes;
  const timeDelta = (ts - prev.ts) / 1000;
  if (timeDelta <= 0 || byteDelta < 0) return undefined;

  return Math.round((byteDelta * 8) / timeDelta);
}

interface RtpStatsResult {
  bitrate: number | null;
  width: number | null;
  height: number | null;
  fps: number | null;
}

// SSRC-agnostic: filter stats by kind ("audio" | "video") instead of matching SSRC values
function parseReportForKind(
  stats: RTCStatsReport,
  kind: "audio" | "video",
  isLocal: boolean,
  prevBytesMap: Map<string, { bytes: number; ts: number }>,
  trackKey: string,
): RtpStatsResult {
  const entryType = isLocal ? "outbound-rtp" : "inbound-rtp";
  let bitrate: number | null = null;
  let width: number | null = null;
  let height: number | null = null;
  let fps: number | null = null;

  for (const [, entry] of stats) {
    if (entry.type !== entryType) continue;
    const e = entry as Record<string, unknown>;
    if (e.kind !== kind) continue;

    const br = extractBitrateFromBytes(e, prevBytesMap, trackKey);
    if (br !== undefined) bitrate = br;

    if (kind === "video") {
      if (e.frameWidth !== undefined) width = e.frameWidth as number;
      if (e.frameHeight !== undefined) height = e.frameHeight as number;
      if (e.framesPerSecond !== undefined) fps = e.framesPerSecond as number;
    }
  }

  return { bitrate, width, height, fps };
}

export function useTrackStats(participantIdentity: string): TrackStats {
  const room = useMaybeRoomContext();
  const [stats, setStats] = useState<TrackStats>(EMPTY_STATS);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevBytesRef = useRef<Map<string, { bytes: number; ts: number }>>(new Map());

  useEffect(() => {
    const currentRoom = room;
    if (!currentRoom) return;
    const r = currentRoom;
    prevBytesRef.current = new Map();

    // 1) Primary: iterate track publications, call track.getRTCStatsReport() on each
    async function pollPerTrack(
      participant: import("livekit-client").Participant | import("livekit-client").LocalParticipant,
      isLocal: boolean,
    ): Promise<TrackStats> {
      let audioBitrate: number | null = null;
      let videoBitrate: number | null = null;
      let videoWidth: number | null = null;
      let videoHeight: number | null = null;
      let videoFps: number | null = null;
      let screenShareBitrate: number | null = null;

      for (const [, pub] of participant.audioTrackPublications) {
        const track = pub.track;
        if (!track) continue;
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const report: RTCStatsReport | undefined = await (track as any).getRTCStatsReport();
          if (!report) continue;
          const result = parseReportForKind(report, "audio", isLocal, prevBytesRef.current, `audio-${pub.trackSid}`);
          if (result.bitrate !== null) audioBitrate = result.bitrate;
        } catch {
          // Per-track stats can fail transiently
        }
      }

      for (const [, pub] of participant.videoTrackPublications) {
        const track = pub.track;
        if (!track) continue;

        const isScreenShare =
          pub.source === Track.Source.ScreenShare ||
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (pub as any)?.track?.source === Track.Source.ScreenShare;

        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const report: RTCStatsReport | undefined = await (track as any).getRTCStatsReport();
          if (!report) continue;
          const result = parseReportForKind(report, "video", isLocal, prevBytesRef.current, `video-${pub.trackSid}`);

          if (isScreenShare) {
            if (result.bitrate !== null) screenShareBitrate = result.bitrate;
            if (videoWidth === null && result.width !== null) {
              videoWidth = result.width;
              videoHeight = result.height;
              videoFps = result.fps;
            }
          } else {
            if (result.bitrate !== null) videoBitrate = result.bitrate;
            if (result.width !== null) videoWidth = result.width;
            if (result.height !== null) videoHeight = result.height;
            if (result.fps !== null) videoFps = result.fps;
          }
        } catch {
          // Per-track stats can fail transiently
        }
      }

      return { audioBitrate, videoBitrate, videoWidth, videoHeight, videoFps, screenShareBitrate };
    }

    // 2) Fallback: room.getStats() (LiveKit 1.5+)
    async function pollWithRoomGetStats(isLocal: boolean): Promise<TrackStats | null> {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const roomAny = r as any;
        if (typeof roomAny.getStats !== "function") return null;
        const report = await roomAny.getStats();
        const audioResult = parseReportForKind(report, "audio", isLocal, prevBytesRef.current, "audio-room");
        const videoResult = parseReportForKind(report, "video", isLocal, prevBytesRef.current, "video-room");
        return {
          audioBitrate: audioResult.bitrate,
          videoBitrate: videoResult.bitrate,
          videoWidth: videoResult.width,
          videoHeight: videoResult.height,
          videoFps: videoResult.fps,
          screenShareBitrate: null,
        };
      } catch {
        return null;
      }
    }

    // 3) Last resort: engine internals (peer connection)
    async function pollWithEngineInternals(isLocal: boolean): Promise<TrackStats | null> {
      try {
        const eng = r.engine as unknown as Record<string, unknown>;
        const pc = isLocal
          ? (eng.publisher as Record<string, unknown> | undefined)?.peerConnection as RTCPeerConnection | undefined
          : (eng.subscriber as Record<string, unknown> | undefined)?.peerConnection as RTCPeerConnection | undefined;

        if (!pc || typeof pc.getStats !== "function") return null;

        const statsReport = await pc.getStats();
        const audioResult = parseReportForKind(statsReport, "audio", isLocal, prevBytesRef.current, "audio-engine");
        const videoResult = parseReportForKind(statsReport, "video", isLocal, prevBytesRef.current, "video-engine");
        return {
          audioBitrate: audioResult.bitrate,
          videoBitrate: videoResult.bitrate,
          videoWidth: videoResult.width,
          videoHeight: videoResult.height,
          videoFps: videoResult.fps,
          screenShareBitrate: null,
        };
      } catch {
        return null;
      }
    }

    function hasAnyStats(s: TrackStats): boolean {
      return s.audioBitrate !== null || s.videoBitrate !== null || s.screenShareBitrate !== null;
    }

    async function poll() {
      try {
        const isLocal = r.localParticipant?.identity === participantIdentity;
        const participant = isLocal
          ? r.localParticipant
          : r.remoteParticipants.get(participantIdentity);

        if (!participant) return;

        // 1) Primary: per-track getRTCStatsReport()
        const perTrackStats = await pollPerTrack(participant, isLocal);
        if (hasAnyStats(perTrackStats)) {
          setStats(perTrackStats);
          return;
        }

        // 2) Fallback: room.getStats()
        const roomStats = await pollWithRoomGetStats(isLocal);
        if (roomStats && hasAnyStats(roomStats)) {
          setStats(roomStats);
          return;
        }

        // 3) Last resort: engine internals
        const engineStats = await pollWithEngineInternals(isLocal);
        if (engineStats) {
          setStats(engineStats);
          return;
        }

        setStats(EMPTY_STATS);
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
