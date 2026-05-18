"use client";

import { useRemoteParticipants, useLocalParticipant } from "@livekit/components-react";
import { useSpaceStore } from "@/lib/store/space";
import { useState } from "react";

export function AudioMixer() {
  const remoteParticipants = useRemoteParticipants();
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const mixerOpen = useSpaceStore((s) => s.mixerOpen);
  const setMixerOpen = useSpaceStore((s) => s.setMixerOpen);
  const [volumes, setVolumes] = useState<Record<string, number>>({});

  function handleVolumeChange(participantIdentity: string, value: number) {
    setVolumes((prev) => ({ ...prev, [participantIdentity]: value }));
    const participant = remoteParticipants.find((p) => p.identity === participantIdentity);
    if (participant) {
      participant.audioTrackPublications.forEach((pub) => {
        const elements = pub.track?.attachedElements;
        if (elements) {
          for (const el of elements) {
            el.volume = value;
          }
        }
      });
    }
  }

  if (!mixerOpen) return null;

  return (
    <div className="fixed right-4 top-[20%] z-40 w-64 bg-[#0A0A0F]/95 backdrop-blur-xl border border-[#00F0FF]/15 rounded-xl shadow-[0_0_30px_rgba(0,240,255,0.08)]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#00F0FF]/10">
        <h3 className="font-['Share_Tech_Mono',monospace] text-xs text-[#00F0FF] uppercase tracking-wider">
          Audio Mixer
        </h3>
        <button
          onClick={() => setMixerOpen(false)}
          className="text-[#A0A0B0] hover:text-[#F0F0F0] text-xs transition-colors"
        >
          ✕
        </button>
      </div>

      <div className="p-3 space-y-3 max-h-80 overflow-y-auto">
        {/* Local participant */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#A0A0B0] font-['Share_Tech_Mono',monospace]">
              You
            </span>
            <span className="text-[10px] text-[#A0A0B0]">
              {isMicrophoneEnabled ? "Mic On" : "Muted"}
            </span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-150"
              style={{
                width: `${isMicrophoneEnabled ? 100 : 30}%`,
                backgroundColor: isMicrophoneEnabled ? "#00F0FF" : "#FF4444",
              }}
            />
          </div>
        </div>

        {/* Remote participants */}
        {remoteParticipants.filter((p) => p.audioTrackPublications.size > 0).length === 0 && (
          <p className="text-[10px] text-[#A0A0B0] text-center py-2">No other participants</p>
        )}

        {remoteParticipants.map((participant) => {
          if (participant.audioTrackPublications.size === 0) return null;
          const vol = volumes[participant.identity] ?? 1;

          return (
            <div key={participant.identity} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#F0F0F0] font-['Share_Tech_Mono',monospace] truncate max-w-[120px]">
                  {participant.name || participant.identity}
                </span>
                <span className="text-[10px] text-[#A0A0B0] tabular-nums">
                  {Math.round(vol * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={vol}
                onChange={(e) => handleVolumeChange(participant.identity, parseFloat(e.target.value))}
                className="w-full h-1.5 appearance-none bg-white/10 rounded-full outline-none cursor-pointer
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
                  [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#00F0FF]
                  [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(0,240,255,0.5)]"
                style={{
                  background: `linear-gradient(to right, rgba(0,240,255,0.25) ${vol * 100}%, rgba(255,255,255,0.1) ${vol * 100}%)`,
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
