"use client";

import { useMemo } from "react";
import {
  useLocalParticipant,
  useRemoteParticipants,
} from "@livekit/components-react";
import type { Participant } from "livekit-client";
import { useTrackStats } from "@/lib/hooks/useTrackStats";

interface ParticipantListProps {
  userId: string;
}

function ParticipantRow({
  participant,
  isLocal,
}: {
  participant: Participant;
  isLocal: boolean;
}) {
  const name = participant.name ?? participant.identity ?? "Unknown";
  const initial = name.charAt(0).toUpperCase();
  const isSpeaking = participant.isSpeaking;
  const audioLevel = isSpeaking ? (participant.audioLevel ?? 0) : 0;
  const isMicOn = participant.isMicrophoneEnabled;
  const isCameraOn = participant.isCameraEnabled;
  const isScreenOn = participant.isScreenShareEnabled;
  const trackStats = useTrackStats(participant.identity);

  function formatBitrate(bps: number | null): string {
    if (bps === null) return "";
    if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)}Mbps`;
    return `${Math.round(bps / 1000)}kbps`;
  }

  function formatResolution(_w: number | null, h: number | null): string {
    if (h === null) return "";
    return `${h}p`;
  }

  function formatFps(fps: number | null): string {
    if (fps === null) return "";
    return `${Math.round(fps)}fps`;
  }

  const hasStats =
    trackStats.audioBitrate !== null ||
    trackStats.videoBitrate !== null ||
    trackStats.screenShareBitrate !== null;

  return (
    <div>
      <div className="flex items-center gap-3 px-3 py-2 hover:bg-white/[0.02] transition-colors">
        {/* Avatar with speaking glow */}
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 border transition-all duration-200"
          style={{
            backgroundColor: "#0F0F13",
            borderColor: isSpeaking
              ? `rgba(0,255,65,${0.3 + audioLevel * 0.5})`
              : "rgba(0,255,65,0.15)",
            boxShadow: isSpeaking
              ? `0 0 ${4 + audioLevel * 12}px rgba(0,255,65,${0.15 + audioLevel * 0.45})`
              : undefined,
            animation: isSpeaking ? "glow-pulse 1.5s ease-in-out infinite" : undefined,
          }}
        >
          <span className="font-mono text-[11px] text-[#F0F0F0]">
            {initial}
          </span>
        </div>

        {/* Name */}
        <div className="flex-1 min-w-0 flex items-center gap-1.5">
          <span className="text-xs text-[#F0F0F0] truncate font-['Fira_Code',monospace]">
            {name}
          </span>
          {isLocal && (
            <span className="text-[9px] px-1.5 py-px rounded-full bg-[#B44DFF]/15 text-[#B44DFF] font-['Share_Tech_Mono',monospace] flex-shrink-0">
              You
            </span>
          )}
        </div>

        {/* Status indicators */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Mic */}
          <span
            className="w-2 h-2 rounded-full transition-colors duration-200"
            style={{
              backgroundColor: isMicOn ? "#00FF41" : "#FF4444",
              boxShadow: isMicOn
                ? "0 0 4px rgba(0,255,65,0.4)"
                : "0 0 2px rgba(255,68,68,0.3)",
            }}
            title={isMicOn ? "Mic on" : "Mic off"}
          />
          {/* Camera */}
          <span
            className="w-2 h-2 rounded-full transition-colors duration-200"
            style={{
              backgroundColor: isCameraOn ? "#00FF41" : "#FF4444",
              boxShadow: isCameraOn
                ? "0 0 4px rgba(0,255,65,0.4)"
                : "0 0 2px rgba(255,68,68,0.3)",
            }}
            title={isCameraOn ? "Camera on" : "Camera off"}
          />
          {/* Screen share */}
          <span
            className="w-2 h-2 rounded-full transition-colors duration-200"
            style={{
              backgroundColor: isScreenOn ? "#00F0FF" : "#A0A0B0",
              boxShadow: isScreenOn
                ? "0 0 4px rgba(0,240,255,0.4)"
                : undefined,
            }}
            title={isScreenOn ? "Screen sharing" : "Not sharing"}
          />
        </div>
      </div>

      {/* Stats row */}
      {hasStats && (
        <div className="flex items-center gap-2 px-3 pb-1.5 ml-10">
          {isMicOn && trackStats.audioBitrate !== null && (
            <span className="text-[8px] text-[#00F0FF] font-['Share_Tech_Mono',monospace] bg-[#00F0FF]/10 px-1 py-0.5 rounded">
              {formatBitrate(trackStats.audioBitrate)}
            </span>
          )}
          {isCameraOn && trackStats.videoBitrate !== null && (
            <span className="text-[8px] text-[#00FF41] font-['Share_Tech_Mono',monospace] bg-[#00FF41]/10 px-1 py-0.5 rounded">
              {formatResolution(trackStats.videoWidth, trackStats.videoHeight)}
              {trackStats.videoFps !== null ? formatFps(trackStats.videoFps) : ""}
              {" "}{formatBitrate(trackStats.videoBitrate)}
            </span>
          )}
          {isScreenOn && trackStats.screenShareBitrate !== null && (
            <span className="text-[8px] text-[#00F0FF] font-['Share_Tech_Mono',monospace] bg-[#00F0FF]/10 px-1 py-0.5 rounded">
              {formatResolution(trackStats.screenShareWidth, trackStats.screenShareHeight)}
              {trackStats.screenShareFps !== null ? formatFps(trackStats.screenShareFps) : ""}
              {" "}{formatBitrate(trackStats.screenShareBitrate)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function ParticipantList({ userId: _ }: ParticipantListProps) {
  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();

  const sorted = useMemo(() => {
    const list: { participant: Participant; isLocal: boolean }[] = [];

    if (localParticipant) {
      list.push({ participant: localParticipant, isLocal: true });
    }

    for (const p of remoteParticipants) {
      list.push({ participant: p, isLocal: false });
    }

    const local = list.find((item) => item.isLocal);
    const remotes = list
      .filter((item) => !item.isLocal)
      .sort((a, b) =>
        (a.participant.name ?? a.participant.identity ?? "").localeCompare(
          b.participant.name ?? b.participant.identity ?? "",
        ),
      );
    const byName = local ? [local, ...remotes] : remotes;

    return byName;
  }, [localParticipant, remoteParticipants]);

  const totalCount = sorted.length;
  const hasRemote = remoteParticipants.length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#00F0FF]/10">
        <h3 className="font-['Share_Tech_Mono',monospace] text-[11px] text-[#00F0FF] uppercase tracking-wider">
          People
        </h3>
        <span className="font-['Share_Tech_Mono',monospace] text-[10px] text-[#A0A0B0] bg-white/5 px-1.5 py-px rounded">
          {totalCount}
        </span>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {sorted.map(({ participant, isLocal }) => (
          <ParticipantRow
            key={participant.identity}
            participant={participant}
            isLocal={isLocal}
          />
        ))}

        {localParticipant && !hasRemote && (
          <p className="text-[10px] text-[#A0A0B0] text-center py-6 italic font-['Fira_Code',monospace]">
            Only you are here
          </p>
        )}
      </div>

      {/* Footer legend */}
      <div className="px-3 py-2 border-t border-[#00F0FF]/10 flex items-center gap-3 text-[9px] text-[#A0A0B0] font-['Share_Tech_Mono',monospace]">
        <span className="flex items-center gap-1">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: "#00FF41" }}
          />
          Mic
        </span>
        <span className="flex items-center gap-1">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: "#00FF41" }}
          />
          Cam
        </span>
        <span className="flex items-center gap-1">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: "#00F0FF" }}
          />
          Screen
        </span>
      </div>
    </div>
  );
}
