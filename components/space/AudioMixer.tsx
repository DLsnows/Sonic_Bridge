"use client";

import { useRemoteParticipants, useLocalParticipant } from "@livekit/components-react";
import { useSpaceStore } from "@/lib/store/space";
import { useVstStore } from "@/lib/store/vst";
import { Track } from "livekit-client";
import { useState, useCallback } from "react";
import { VstVolumeMeter } from "./VstVolumeMeter";

export function AudioMixer() {
  const remoteParticipants = useRemoteParticipants();
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const mixerOpen = useSpaceStore((s) => s.mixerOpen);
  const setMixerOpen = useSpaceStore((s) => s.setMixerOpen);
  const [volumes, setVolumes] = useState<Record<string, number>>({});
  const [micVolume, setMicVolume] = useState(1);

  // VST store — DAW volume and meter
  const vstVolume = useVstStore((s) => s.vstVolume);
  const setVstVolume = useVstStore((s) => s.setVstVolume);
  const audioTrackPublished = useVstStore((s) => s.audioTrackPublished);
  const vstStatus = useVstStore((s) => s.status);
  const meterLeft = useVstStore((s) => s.meterLeft);
  const meterRight = useVstStore((s) => s.meterRight);
  const meterPeak = useVstStore((s) => s.meterPeak);

  const handleMicVolumeChange = useCallback(
    (value: number) => {
      setMicVolume(value);
      for (const pub of localParticipant.audioTrackPublications.values()) {
        if (
          pub.kind === Track.Kind.Audio &&
          pub.trackName !== "DAW Audio (VST)" &&
          typeof pub.setVolume === "function"
        ) {
          pub.setVolume(value);
        }
      }
    },
    [localParticipant],
  );

  const handleRemoteVolumeChange = useCallback(
    (participantIdentity: string, value: number) => {
      setVolumes((prev) => ({ ...prev, [participantIdentity]: value }));
      const participant = remoteParticipants.find(
        (p) => p.identity === participantIdentity,
      );
      if (!participant) return;
      participant.audioTrackPublications.forEach((pub) => {
        if (typeof pub.setVolume === "function") {
          pub.setVolume(value);
        }
        // HTMLMediaElement fallback
        const audioTrack = pub.track;
        if (audioTrack?.attachedElements) {
          for (const el of audioTrack.attachedElements) {
            el.volume = value;
          }
        }
      });
    },
    [remoteParticipants],
  );

  if (!mixerOpen) return null;

  const hasRemoteAudio =
    remoteParticipants.filter((p) => p.audioTrackPublications.size > 0).length > 0;

  return (
    <div className="fixed right-4 top-[20%] z-40 w-72 bg-[#0A0A0F]/95 backdrop-blur-xl border border-[#00F0FF]/15 rounded-xl shadow-[0_0_30px_rgba(0,240,255,0.08)]">
      {/* Header */}
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

      <div className="p-3 space-y-4 max-h-[60vh] overflow-y-auto">
        {/* ===== INPUTS SECTION ===== */}
        <div className="space-y-3">
          <h4 className="font-['Share_Tech_Mono',monospace] text-[10px] text-[#00F0FF]/60 uppercase tracking-wider border-b border-[#00F0FF]/10 pb-1">
            Inputs
          </h4>

          {/* DAW/VST Channel */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[#F0F0F0] font-['Share_Tech_Mono',monospace] truncate max-w-[160px]">
                DAW Audio (VST)
              </span>
              <span className="text-[10px] text-[#A0A0B0] tabular-nums">
                {Math.round(vstVolume * 100)}%
              </span>
            </div>
            {vstStatus === "connected" && audioTrackPublished ? (
              <VstVolumeMeter left={meterLeft} right={meterRight} peak={meterPeak} />
            ) : (
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full w-0 rounded-full" />
              </div>
            )}
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={vstVolume}
              onChange={(e) => setVstVolume(parseFloat(e.target.value))}
              className="w-full h-1.5 appearance-none bg-white/10 rounded-full outline-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#00F0FF]
                [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(0,240,255,0.5)]"
              style={{
                background: `linear-gradient(to right, rgba(0,240,255,0.25) ${vstVolume * 100}%, rgba(255,255,255,0.1) ${vstVolume * 100}%)`,
              }}
            />
          </div>

          {/* Local Microphone Channel */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[#F0F0F0] font-['Share_Tech_Mono',monospace]">
                Microphone
              </span>
              <span className="text-[10px] text-[#A0A0B0] tabular-nums">
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
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={micVolume}
              onChange={(e) => handleMicVolumeChange(parseFloat(e.target.value))}
              className="w-full h-1.5 appearance-none bg-white/10 rounded-full outline-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#00F0FF]
                [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(0,240,255,0.5)]"
              style={{
                background: `linear-gradient(to right, rgba(0,240,255,0.25) ${micVolume * 100}%, rgba(255,255,255,0.1) ${micVolume * 100}%)`,
              }}
            />
          </div>
        </div>

        {/* ===== OUTPUTS SECTION ===== */}
        <div className="space-y-3">
          <h4 className="font-['Share_Tech_Mono',monospace] text-[10px] text-[#00F0FF]/60 uppercase tracking-wider border-b border-[#00F0FF]/10 pb-1">
            Outputs
          </h4>

          {!hasRemoteAudio && (
            <p className="text-[10px] text-[#A0A0B0] text-center py-2">
              No other participants
            </p>
          )}

          {remoteParticipants.map((participant) => {
            if (participant.audioTrackPublications.size === 0) return null;
            const vol = volumes[participant.identity] ?? 1;

            return (
              <div key={participant.identity} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#F0F0F0] font-['Share_Tech_Mono',monospace] truncate max-w-[160px]">
                    {participant.name || participant.identity}
                  </span>
                  <span className="text-[10px] text-[#A0A0B0] tabular-nums">
                    {Math.round(vol * 100)}%
                  </span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-75"
                    style={{
                      width: `${vol * 100}%`,
                      backgroundColor: "#00F0FF",
                    }}
                  />
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={vol}
                  onChange={(e) =>
                    handleRemoteVolumeChange(
                      participant.identity,
                      parseFloat(e.target.value),
                    )
                  }
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
    </div>
  );
}
