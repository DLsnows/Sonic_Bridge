"use client";

import { useRef, useState } from "react";
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
  error: "Missing",
};

export function VstConnectionPanel() {
  const status = useVstStore((s) => s.status);
  const pluginName = useVstStore((s) => s.pluginName);
  const version = useVstStore((s) => s.version);
  const meterLeft = useVstStore((s) => s.meterLeft);
  const meterRight = useVstStore((s) => s.meterRight);
  const meterPeak = useVstStore((s) => s.meterPeak);
  const sampleRate = useVstStore((s) => s.sampleRate);
  const channels = useVstStore((s) => s.channels);
  const lastError = useVstStore((s) => s.lastError);
  const audioTrackPublished = useVstStore((s) => s.audioTrackPublished);
  const broadcastEnabled = useVstStore((s) => s.broadcastEnabled);
  const setBroadcastEnabled = useVstStore((s) => s.setBroadcastEnabled);
  const requestReconnect = useVstStore((s) => s.requestReconnect);
  const preferredPort = useVstStore((s) => s.preferredPort);
  const setPreferredPort = useVstStore((s) => s.setPreferredPort);
  const portInputRef = useRef<HTMLInputElement>(null);
  const [collapsed, setCollapsed] = useState(false);

  const color = statusColors[status] ?? statusColors.disconnected;

  if (collapsed) {
    return (
      <div
        className="p-3 cursor-pointer hover:bg-white/[0.02] transition-colors border-b border-[#00F0FF]/10"
        onClick={() => setCollapsed(false)}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">◈</span>
          <span className="font-['Share_Tech_Mono',monospace] text-[10px] text-[#00F0FF] uppercase tracking-wider">
            DAW Bridge
          </span>
          <span
            className="w-2 h-2 rounded-full ml-auto"
            style={{
              backgroundColor: color,
              boxShadow: status === "connected" ? `0 0 6px ${color}` : "none",
            }}
          />
          <span className="text-[9px] text-[#A0A0B0]">▶</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-lg">◈</span>
        <h3 className="font-['Share_Tech_Mono',monospace] text-xs text-[#00F0FF] uppercase tracking-wider">
          DAW Audio Bridge
        </h3>
        <button
          onClick={() => setCollapsed(true)}
          className="ml-auto text-[10px] text-[#A0A0B0] hover:text-[#F0F0F0] transition-colors"
          title="Collapse"
        >
          ▲
        </button>
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
        <div className="space-y-2">
          <div className="text-[10px] text-[#FF4444] bg-[#FF4444]/10 rounded p-2 border border-[#FF4444]/20">
            {lastError}
          </div>
          <button
            onClick={requestReconnect}
            className="w-full py-1.5 text-[10px] text-[#00F0FF] bg-[#00F0FF]/10 border border-[#00F0FF]/20 rounded hover:bg-[#00F0FF]/20 transition-colors font-['Share_Tech_Mono',monospace]"
          >
            Reconnect
          </button>
        </div>
      )}

      {/* Disconnected guidance */}
      {status === "disconnected" && (
        <div className="space-y-2">
          <p className="text-[10px] text-[#A0A0B0] leading-relaxed">
            Load the SonicBridge VST plugin in your DAW and open this project to
            stream audio.
          </p>
          <button
            onClick={requestReconnect}
            className="w-full py-1.5 text-[10px] text-[#00F0FF] bg-[#00F0FF]/10 border border-[#00F0FF]/20 rounded hover:bg-[#00F0FF]/20 transition-colors font-['Share_Tech_Mono',monospace]"
          >
            Reconnect
          </button>
        </div>
      )}

      {/* Port input (disconnected or error) */}
      {(status === "disconnected" || status === "error") && (
        <div className="space-y-2 pt-2 border-t border-[#00F0FF]/10">
          <p className="text-[10px] text-[#A0A0B0] font-['Share_Tech_Mono',monospace] uppercase tracking-wider">
            Port
          </p>
          <div className="flex gap-2">
            <input
              ref={portInputRef}
              type="number"
              defaultValue={String(preferredPort)}
              placeholder="9420"
              className="flex-1 bg-black/60 border border-[#00F0FF]/20 rounded px-2 py-1 text-[10px] text-[#F0F0F0] font-mono outline-none focus:border-[#00F0FF]/50"
            />
            <button
              onClick={() => {
                const val = portInputRef.current?.value ?? String(preferredPort);
                const port = parseInt(val, 10);
                if (port > 0 && port < 65536) {
                  setPreferredPort(port);
                  requestReconnect();
                }
              }}
              className="px-3 py-1 text-[10px] text-[#00F0FF] bg-[#00F0FF]/10 border border-[#00F0FF]/20 rounded hover:bg-[#00F0FF]/20 transition-colors font-['Share_Tech_Mono',monospace]"
            >
              Connect
            </button>
          </div>
          <p className="text-[9px] text-[#A0A0B0]">
            Enter the port shown in your DAW&apos;s SonicBridge VST window
          </p>
        </div>
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
          {(sampleRate || channels) && (
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
                {channels && (
                  <>
                    <span className="text-[#A0A0B0]">Channels</span>
                    <span className="text-[#F0F0F0] font-mono text-right">
                      {channels === 2 ? "Stereo" : `${channels}ch`}
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
