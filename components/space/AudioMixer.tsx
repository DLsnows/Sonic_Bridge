"use client";

import { useRemoteParticipants, useLocalParticipant } from "@livekit/components-react";
import { useSpaceStore } from "@/lib/store/space";
import { useVstStore } from "@/lib/store/vst";
import { useMediaSettingsStore } from "@/lib/store/media-settings";
import { getMicPipeline } from "@/lib/mic-pipeline";
import { Track } from "livekit-client";
import type { RemoteAudioTrack, RemoteParticipant } from "livekit-client";
import { useState, useCallback, useEffect, useRef } from "react";
import { useTrackAudioLevelDb } from "@/lib/hooks/useTrackAudioLevel";
import { VstVolumeMeter } from "./VstVolumeMeter";

const sliderClass =
  "w-full h-1.5 appearance-none bg-white/10 rounded-full outline-none cursor-pointer " +
  "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 " +
  "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#00F0FF] " +
  "[&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(0,240,255,0.5)] " +
  "[&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full " +
  "[&::-moz-range-thumb]:bg-[#00F0FF] [&::-moz-range-thumb]:border-0 " +
  "[&::-moz-range-track]:bg-transparent";

// dBFS scale: floor at -60 dB (silence), ceiling at +5 dB so post-0 dBFS
// overshoot is still visible (~7.7% of the bar above the 0 dB mark).
const METER_DB_FLOOR = -60;
const METER_DB_CEILING = 5;
const METER_DB_RANGE = METER_DB_CEILING - METER_DB_FLOOR;

function dbToPercent(db: number): number {
  if (!isFinite(db) || db <= METER_DB_FLOOR) return 0;
  const clamped = Math.min(db, METER_DB_CEILING);
  return ((clamped - METER_DB_FLOOR) / METER_DB_RANGE) * 100;
}

function micMeterDbColor(db: number): string {
  if (!isFinite(db) || db <= METER_DB_FLOOR) return "#00F0FF";
  if (db > -3) return "#FF4444";
  if (db > -12) return "#FFB800";
  if (db > -24) return "#00FF41";
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
  const noiseMode = useMediaSettingsStore((s) => s.audioQuality.noiseMode);
  const setNoiseMode = useMediaSettingsStore((s) => s.setNoiseMode);
  const dawBitrate = useMediaSettingsStore((s) => s.dawAudio.bitrate);
  const setDawBitrate = useMediaSettingsStore((s) => s.setDawBitrate);
  const sendBufferMs = useMediaSettingsStore((s) => s.audioQuality.sendBufferMs);
  const setSendBufferMs = useMediaSettingsStore((s) => s.setSendBufferMs);
  const receiveBufferMs = useMediaSettingsStore((s) => s.audioQuality.receiveBufferMs);
  const setReceiveBufferMs = useMediaSettingsStore((s) => s.setReceiveBufferMs);
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();

  const micPub = localParticipant?.getTrackPublication(Track.Source.Microphone);
  const micTrack = micPub?.audioTrack;
  const liveMicDb = useTrackAudioLevelDb(micTrack);
  const liveMicPercent = dbToPercent(liveMicDb);
  const liveMicColor = micMeterDbColor(liveMicDb);

  const restartingRef = useRef(false);

  useEffect(() => {
    if (!isMicrophoneEnabled) return;
    if (restartingRef.current) return;
    const nm = useMediaSettingsStore.getState().audioQuality.noiseMode;
    const pipeline = getMicPipeline();
    if (!pipeline.isRunning) return;
    const lp = localParticipant;
    const pub = lp.getTrackPublication(Track.Source.Microphone);
    if (!pub?.track) return;
    restartingRef.current = true;
    lp.unpublishTrack(pub.track).then(() => {
      pipeline.stop();
      return pipeline.start({
        echoCancellation: true,
        noiseSuppression: nm === "suppression",
        voiceIsolation: nm === "voiceIsolation",
      });
    }).then((track) => {
      return lp.publishTrack(track, { source: Track.Source.Microphone });
    }).catch(() => {
      // On failure, re-publish the original track if possible
      if (pipeline.isRunning && pipeline.processedTrack) {
        lp.publishTrack(pipeline.processedTrack, { source: Track.Source.Microphone }).catch(() => {});
      }
    }).finally(() => {
      restartingRef.current = false;
    });
  }, [noiseMode]);

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
                  width: `${liveMicPercent}%`,
                  backgroundColor: liveMicColor,
                  boxShadow: `0 0 6px ${liveMicColor}40`,
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

        {/* DAW Bitrate */}
        <div className="space-y-1 pt-2 border-t border-[#00F0FF]/10">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#A0A0B0] font-['Share_Tech_Mono',monospace]">
              DAW Bitrate
            </span>
            <span className="text-[10px] text-[#F0F0F0] tabular-nums">
              {Math.round(dawBitrate / 1000)} kbps
            </span>
          </div>
          <input type="range" min="192000" max="510000" step="2000" value={dawBitrate}
            onChange={(e) => setDawBitrate(parseInt(e.target.value))}
            className={sliderClass}
            style={{ background: `linear-gradient(to right, rgba(0,240,255,0.25) ${((dawBitrate - 192000) / (510000 - 192000)) * 100}%, rgba(255,255,255,0.1) ${((dawBitrate - 192000) / (510000 - 192000)) * 100}%)` }}
          />
        </div>

        {/* DAW Send Buffer */}
        <div className="space-y-1 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#A0A0B0] font-['Share_Tech_Mono',monospace]">
              DAW Send Buffer
            </span>
            <span className="text-[10px] text-[#F0F0F0] tabular-nums">
              {sendBufferMs}ms
            </span>
          </div>
          <input type="range" min="8" max="2048" step="8" value={sendBufferMs}
            onChange={(e) => setSendBufferMs(parseInt(e.target.value))}
            className={sliderClass}
            style={{ background: `linear-gradient(to right, rgba(0,240,255,0.25) ${(sendBufferMs / 2048) * 100}%, rgba(255,255,255,0.1) ${(sendBufferMs / 2048) * 100}%)` }}
          />
        </div>

        {/* ===== OUTPUTS ===== */}
        <div className="space-y-3">
          <h4 className="font-['Share_Tech_Mono',monospace] text-[10px] text-[#00F0FF]/60 uppercase tracking-wider border-b border-[#00F0FF]/10 pb-1">
            Outputs
          </h4>

        {/* Receive Buffer (all audio) */}
        <div className="space-y-1 pb-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#A0A0B0] font-['Share_Tech_Mono',monospace]">
              Receive Buffer
            </span>
            <span className="text-[10px] text-[#F0F0F0] tabular-nums">
              {receiveBufferMs}ms
            </span>
          </div>
          <input type="range" min="8" max="2048" step="8" value={receiveBufferMs}
            onChange={(e) => setReceiveBufferMs(parseInt(e.target.value))}
            className={sliderClass}
            style={{ background: `linear-gradient(to right, rgba(0,240,255,0.25) ${(receiveBufferMs / 2048) * 100}%, rgba(255,255,255,0.1) ${(receiveBufferMs / 2048) * 100}%)` }}
          />
        </div>

          {!hasRemoteAudio && (
            <p className="text-[10px] text-[#A0A0B0] text-center py-2">
              No other participants
            </p>
          )}

          {remoteParticipants.map((participant) => {
            if (participant.audioTrackPublications.size === 0) return null;
            const vol = volumes[participant.identity] ?? 1;
            return (
              <RemoteParticipantRow
                key={participant.identity}
                participant={participant}
                vol={vol}
                onVolumeChange={handleRemoteVolumeChange}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function RemoteParticipantRow({
  participant,
  vol,
  onVolumeChange,
}: {
  participant: RemoteParticipant;
  vol: number;
  onVolumeChange: (identity: string, value: number) => void;
}) {
  const pubs = Array.from(participant.audioTrackPublications.values());
  const micPub = pubs.find((p) => p.source === Track.Source.Microphone);
  const audioTrack = micPub?.audioTrack as RemoteAudioTrack | undefined;
  const db = useTrackAudioLevelDb(audioTrack);
  const percent = dbToPercent(db);
  const meterColor = micMeterDbColor(db);

  return (
    <div className="space-y-1">
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
            width: `${percent}%`,
            backgroundColor: meterColor,
            boxShadow: `0 0 6px ${meterColor}40`,
          }}
        />
      </div>
      <input
        type="range"
        min="0"
        max="2"
        step="0.01"
        value={vol}
        onChange={(e) => onVolumeChange(participant.identity, parseFloat(e.target.value))}
        className={sliderClass}
        style={{
          background: `linear-gradient(to right, rgba(0,240,255,0.25) ${vol * 50}%, rgba(255,255,255,0.1) ${vol * 50}%)`,
        }}
      />
    </div>
  );
}

