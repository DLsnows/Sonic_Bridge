"use client";

import { useRemoteParticipants, useMaybeRoomContext, useLocalParticipant } from "@livekit/components-react";
import { useSpaceStore } from "@/lib/store/space";
import { useVstStore } from "@/lib/store/vst";
import { useMediaSettingsStore } from "@/lib/store/media-settings";
import { getMicProcessor } from "@/lib/mic-processor";
import { useState, useCallback, useEffect } from "react";
import { VstVolumeMeter } from "./VstVolumeMeter";

const sliderClass =
  "w-full h-1.5 appearance-none bg-white/10 rounded-full outline-none cursor-pointer " +
  "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 " +
  "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#00F0FF] " +
  "[&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(0,240,255,0.5)] " +
  "[&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full " +
  "[&::-moz-range-thumb]:bg-[#00F0FF] [&::-moz-range-thumb]:border-0 " +
  "[&::-moz-range-track]:bg-transparent";

function micMeterLevelColor(level: number): string {
  if (level > 0.75) return "#FF4444";
  if (level > 0.5) return "#FFB800";
  if (level > 0.05) return "#00FF41";
  return "#00F0FF";
}

export function AudioMixer() {
  const remoteParticipants = useRemoteParticipants();
  const mixerOpen = useSpaceStore((s) => s.mixerOpen);
  const setMixerOpen = useSpaceStore((s) => s.setMixerOpen);
  const [volumes, setVolumes] = useState<Record<string, number>>({});

  const vstVolume = useVstStore((s) => s.vstVolume);
  const setVstVolume = useVstStore((s) => s.setVstVolume);
  const audioTrackPublished = useVstStore((s) => s.audioTrackPublished);
  const vstStatus = useVstStore((s) => s.status);
  const meterLeft = useVstStore((s) => s.meterLeft);
  const meterRight = useVstStore((s) => s.meterRight);
  const meterPeak = useVstStore((s) => s.meterPeak);
  const micVolume = useVstStore((s) => s.micVolume);
  const setMicVolume = useVstStore((s) => s.setMicVolume);
  const micMeterLevel = useVstStore((s) => s.micMeterLevel);
  const audioBitrate = useMediaSettingsStore((s) => s.audioQuality.bitrate);
  const setAudioBitrate = useMediaSettingsStore((s) => s.setAudioBitrate);
  const noiseSuppression = useMediaSettingsStore((s) => s.audioQuality.noiseSuppression);
  const setNoiseSuppression = useMediaSettingsStore((s) => s.setNoiseSuppression);
  const voiceIsolation = useMediaSettingsStore((s) => s.audioQuality.voiceIsolation);
  const setVoiceIsolation = useMediaSettingsStore((s) => s.setVoiceIsolation);

  const room = useMaybeRoomContext();
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();

  useEffect(() => {
    if (!room || !isMicrophoneEnabled) return;
    const micOptions = {
      ...getMicProcessor().getCaptureOptions(),
      noiseSuppression: noiseSuppression,
      voiceIsolation: voiceIsolation,
    };
    localParticipant.setMicrophoneEnabled(false).then(() => {
      localParticipant.setMicrophoneEnabled(true, micOptions);
    }).catch(() => {});
  }, [noiseSuppression, voiceIsolation]);

  const handleRemoteVolumeChange = useCallback(
    (participantIdentity: string, value: number) => {
      setVolumes((prev) => ({ ...prev, [participantIdentity]: value }));
      const participant = remoteParticipants.find(
        (p) => p.identity === participantIdentity,
      );
      if (!participant) return;
      participant.audioTrackPublications.forEach((pub) => {
        const p = pub as { setVolume?(v: number): void; track?: { attachedElements?: HTMLMediaElement[] } };
        if (typeof p.setVolume === "function") {
          p.setVolume(value);
        } else if (p.track?.attachedElements) {
          for (const el of p.track.attachedElements) {
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
    <div className="fixed left-1/2 -translate-x-1/2 top-[20%] z-40 w-72 bg-[#0A0A0F]/95 backdrop-blur-xl border border-[#00F0FF]/15 rounded-xl shadow-[0_0_30px_rgba(0,240,255,0.08)]">
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
        {/* ===== INPUTS ===== */}
        <div className="space-y-3">
          <h4 className="font-['Share_Tech_Mono',monospace] text-[10px] text-[#00F0FF]/60 uppercase tracking-wider border-b border-[#00F0FF]/10 pb-1">
            Inputs
          </h4>

          {/* Local Microphone */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[#F0F0F0] font-['Share_Tech_Mono',monospace] truncate max-w-[130px]">
                Local Microphone
              </span>
              <span className="text-[10px] text-[#A0A0B0] tabular-nums">
                Gain: {Math.round(micVolume * 100)}%
              </span>
            </div>
            <div className="h-2 bg-white/5 rounded-full overflow-hidden border border-[#00FF41]/10 relative">
              <div
                className="h-full rounded-full transition-all duration-75"
                style={{
                  width: `${micMeterLevel * 100}%`,
                  backgroundColor: micMeterLevelColor(micMeterLevel),
                  boxShadow: `0 0 6px ${micMeterLevelColor(micMeterLevel)}40`,
                }}
              />
            </div>
            <input
              type="range"
              min="0"
              max="2"
              step="0.01"
              value={micVolume}
              onChange={(e) => setMicVolume(parseFloat(e.target.value))}
              className={sliderClass}
              style={{
                background: `linear-gradient(to right, rgba(0,240,255,0.25) ${micVolume * 50}%, rgba(255,255,255,0.1) ${micVolume * 50}%)`,
              }}
            />
          </div>

          {/* Mic Processing Toggles */}
          <div className="flex items-center gap-2 py-1">
            <button
              onClick={() => setNoiseSuppression(!noiseSuppression)}
              className={`flex-1 px-2 py-1 rounded-full text-[10px] font-['Share_Tech_Mono',monospace] transition-all ${
                noiseSuppression
                  ? "bg-[#00FF41]/20 text-[#00FF41] border border-[#00FF41]/30"
                  : "bg-white/5 text-[#A0A0B0] border border-white/10"
              }`}
            >
              Noise Suppression
            </button>
            <button
              onClick={() => setVoiceIsolation(!voiceIsolation)}
              className={`flex-1 px-2 py-1 rounded-full text-[10px] font-['Share_Tech_Mono',monospace] transition-all ${
                voiceIsolation
                  ? "bg-[#BF5AF2]/20 text-[#BF5AF2] border border-[#BF5AF2]/30"
                  : "bg-white/5 text-[#A0A0B0] border border-white/10"
              }`}
            >
              Voice Isolation (Chrome)
            </button>
          </div>

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
              max="2"
              step="0.01"
              value={vstVolume}
              onChange={(e) => setVstVolume(parseFloat(e.target.value))}
              className={sliderClass}
              style={{
                background: `linear-gradient(to right, rgba(0,240,255,0.25) ${vstVolume * 50}%, rgba(255,255,255,0.1) ${vstVolume * 50}%)`,
              }}
            />
          </div>
        </div>

        {/* Opus Bitrate (LiveKit encoder) */}
        <div className="space-y-1 pt-2 border-t border-[#00F0FF]/10">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#A0A0B0] font-['Share_Tech_Mono',monospace]">
              Opus Bitrate
            </span>
            <span className="text-[10px] text-[#F0F0F0] tabular-nums">
              {Math.round(audioBitrate / 1000)} kbps
            </span>
          </div>
          <input
            type="range"
            min="192000"
            max="640000"
            step="32000"
            value={audioBitrate}
            onChange={(e) => setAudioBitrate(parseInt(e.target.value))}
            className={sliderClass}
            style={{
              background: `linear-gradient(to right, rgba(0,240,255,0.25) ${((audioBitrate - 192000) / (640000 - 192000)) * 100}%, rgba(255,255,255,0.1) ${((audioBitrate - 192000) / (640000 - 192000)) * 100}%)`,
            }}
          />
        </div>

        {/* ===== OUTPUTS ===== */}
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
                      width: `${vol * 50}%`,
                      backgroundColor: "#00F0FF",
                    }}
                  />
                </div>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.01"
                  value={vol}
                  onChange={(e) =>
                    handleRemoteVolumeChange(
                      participant.identity,
                      parseFloat(e.target.value),
                    )
                  }
                  className={sliderClass}
                  style={{
                    background: `linear-gradient(to right, rgba(0,240,255,0.25) ${vol * 50}%, rgba(255,255,255,0.1) ${vol * 50}%)`,
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
