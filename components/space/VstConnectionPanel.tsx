"use client";

import { useVstStore } from "@/lib/store/vst";
import { VstVolumeMeter } from "./VstVolumeMeter";

const statusColors: Record<string, string> = {
  connected: "#00FF41",
  connecting: "#FFB800",
  disconnected: "#A0A0B0",
  error: "#FF4444",
};

const statusLabels: Record<string, string> = {
  connected: "Connected",
  connecting: "Connecting...",
  disconnected: "Disconnected",
  error: "Error",
};

export function VstConnectionPanel() {
  const status = useVstStore((s) => s.status);
  const pluginName = useVstStore((s) => s.pluginName);
  const version = useVstStore((s) => s.version);
  const meterLeft = useVstStore((s) => s.meterLeft);
  const meterRight = useVstStore((s) => s.meterRight);
  const meterPeak = useVstStore((s) => s.meterPeak);
  const sampleRate = useVstStore((s) => s.sampleRate);
  const bufferSize = useVstStore((s) => s.bufferSize);
  const channels = useVstStore((s) => s.channels);
  const opusBitrate = useVstStore((s) => s.opusBitrate);
  const lastError = useVstStore((s) => s.lastError);
  const audioTrackPublished = useVstStore((s) => s.audioTrackPublished);
  const broadcastEnabled = useVstStore((s) => s.broadcastEnabled);
  const setBroadcastEnabled = useVstStore((s) => s.setBroadcastEnabled);

  const color = statusColors[status] ?? statusColors.disconnected;

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-lg">◈</span>
        <h3 className="font-['Share_Tech_Mono',monospace] text-xs text-[#00FF41] uppercase tracking-wider">
          DAW Audio Bridge
        </h3>
      </div>

      {/* Status LED */}
      <div className="flex items-center gap-3">
        <span
          className="w-2.5 h-2.5 rounded-full inline-block"
          style={{
            backgroundColor: color,
            boxShadow:
              status === "connected"
                ? `0 0 8px ${color}, 0 0 16px ${color}40`
                : "none",
            animation:
              status === "connecting" ? "glow-pulse 1s ease-in-out infinite" : "none",
          }}
        />
        <div>
          <span
            className="font-['Share_Tech_Mono',monospace] text-xs"
            style={{ color }}
          >
            {statusLabels[status]}
          </span>
          {pluginName && (
            <p className="text-[10px] text-[#A0A0B0] mt-0.5">
              {pluginName} v{version}
            </p>
          )}
        </div>
      </div>

      {/* Error message */}
      {lastError && status === "error" && (
        <div className="text-[10px] text-[#FF4444] bg-[#FF4444]/10 rounded p-2 border border-[#FF4444]/20">
          {lastError}
        </div>
      )}

      {/* Disconnected guidance */}
      {status === "disconnected" && (
        <p className="text-[10px] text-[#A0A0B0] leading-relaxed">
          Load the SonicBridge VST plugin in your DAW and open this project to
          stream audio.
        </p>
      )}

      {/* Volume Meter */}
      {status === "connected" && (
        <>
          <div>
            <p className="text-[10px] text-[#A0A0B0] font-['Share_Tech_Mono',monospace] mb-2 uppercase tracking-wider">
              Level
            </p>
            <VstVolumeMeter
              left={meterLeft}
              right={meterRight}
              peak={meterPeak}
            />
          </div>

          {/* Audio Settings */}
          {(sampleRate || bufferSize || opusBitrate) && (
            <div className="space-y-1">
              <p className="text-[10px] text-[#A0A0B0] font-['Share_Tech_Mono',monospace] uppercase tracking-wider">
                Audio
              </p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
                {sampleRate && (
                  <>
                    <span className="text-[#A0A0B0]">Sample Rate</span>
                    <span className="text-[#F0F0F0] font-mono text-right">
                      {(sampleRate / 1000).toFixed(0)} kHz
                    </span>
                  </>
                )}
                {bufferSize && (
                  <>
                    <span className="text-[#A0A0B0]">Buffer</span>
                    <span className="text-[#F0F0F0] font-mono text-right">
                      {bufferSize} smp
                    </span>
                  </>
                )}
                {channels && (
                  <>
                    <span className="text-[#A0A0B0]">Channels</span>
                    <span className="text-[#F0F0F0] font-mono text-right">
                      {channels === 2 ? "Stereo" : `${channels}ch`}
                    </span>
                  </>
                )}
                {opusBitrate && (
                  <>
                    <span className="text-[#A0A0B0]">Opus Bitrate</span>
                    <span className="text-[#F0F0F0] font-mono text-right">
                      {Math.round(opusBitrate / 1000)} kbps
                    </span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Broadcast Toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={broadcastEnabled}
              onChange={(e) => setBroadcastEnabled(e.target.checked)}
              className="w-3.5 h-3.5 rounded accent-[#00FF41] bg-black/60 border border-[#00FF41]/20 cursor-pointer"
            />
            <span className="text-[10px] text-[#F0F0F0] font-['Share_Tech_Mono',monospace]">
              Broadcast to Room
            </span>
          </label>

          {/* Published status */}
          {broadcastEnabled && (
            <div className="flex items-center gap-2 text-[10px]">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  audioTrackPublished ? "bg-[#00FF41]" : "bg-[#FFB800]"
                }`}
              />
              <span className="text-[#A0A0B0]">
                {audioTrackPublished
                  ? "Audio track published"
                  : "Publishing audio..."}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
