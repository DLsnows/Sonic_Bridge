"use client";

import { useMediaSettingsStore, msToSamples, type VideoFps, type VideoResolution, type ScreenResolution, type NoiseMode } from "@/lib/store/media-settings";
import { Modal } from "@/components/ui/Modal";

interface MediaSettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

const BITRATE_STEP = 32000; // 32 kbps step
const BITRATE_MIN = 192000;
const BITRATE_MAX = 640000;
const BUFFER_MIN_MS = 8;
const BUFFER_MAX_MS = 2048;
const BUFFER_STEP_MS = 8;

const SCREEN_BITRATE_MIN = 500_000;
const SCREEN_BITRATE_MAX = 5_000_000;
const SCREEN_BITRATE_STEP = 250_000;

const FPS_OPTIONS: { label: string; value: VideoFps }[] = [
  { label: "15 fps", value: 15 },
  { label: "30 fps", value: 30 },
  { label: "60 fps", value: 60 },
];

const RESOLUTION_OPTIONS: { label: string; value: ScreenResolution }[] = [
  { label: "720p (1280×720)", value: "720p" },
  { label: "1080p (1920×1080)", value: "1080p" },
  { label: "Original", value: "original" },
];

function bufferLabel(ms: number): string {
  const samples = msToSamples(ms);
  return `${ms}ms (${samples} smp)`;
}

function bitrateLabel(bps: number): string {
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} Mbps`;
  return `${Math.round(bps / 1000)} kbps`;
}

export function MediaSettingsPanel({ open, onClose }: MediaSettingsPanelProps) {
  const audioQuality = useMediaSettingsStore((s) => s.audioQuality);
  const screenShare = useMediaSettingsStore((s) => s.screenShare);
  const setAudioBitrate = useMediaSettingsStore((s) => s.setAudioBitrate);
  const setSendBufferMs = useMediaSettingsStore((s) => s.setSendBufferMs);
  const setReceiveBufferMs = useMediaSettingsStore((s) => s.setReceiveBufferMs);
  const setScreenFps = useMediaSettingsStore((s) => s.setScreenFps);
  const setScreenResolution = useMediaSettingsStore((s) => s.setScreenResolution);
  const setScreenBitrate = useMediaSettingsStore((s) => s.setScreenBitrate);

  return (
    <Modal open={open} onClose={onClose} title="Media Quality Settings">
      <div className="space-y-6">
        {/* Audio Quality Section */}
        <section>
          <h3 className="text-xs font-['Share_Tech_Mono',monospace] text-[#00F0FF] uppercase tracking-wider mb-3">
            Audio Quality (Opus)
          </h3>

          {/* Bitrate */}
          <div className="mb-4">
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-[#A0A0B0] font-['Share_Tech_Mono',monospace]">Bitrate</span>
              <span className="text-[#F0F0F0] font-mono">{bitrateLabel(audioQuality.bitrate)}</span>
            </div>
            <input
              type="range"
              min={BITRATE_MIN}
              max={BITRATE_MAX}
              step={BITRATE_STEP}
              value={audioQuality.bitrate}
              onChange={(e) => setAudioBitrate(Number(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer
                bg-[#00F0FF]/20 accent-[#00F0FF]
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#00F0FF] [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(0,240,255,0.5)]"
            />
            <div className="flex justify-between text-[8px] text-[#A0A0B0] mt-0.5">
              <span>192 kbps</span>
              <span>640 kbps</span>
            </div>
          </div>

          {/* Send Buffer */}
          <div className="mb-4">
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-[#A0A0B0] font-['Share_Tech_Mono',monospace]">Send Buffer</span>
              <span className="text-[#F0F0F0] font-mono">{bufferLabel(audioQuality.sendBufferMs)}</span>
            </div>
            <input
              type="range"
              min={BUFFER_MIN_MS}
              max={BUFFER_MAX_MS}
              step={BUFFER_STEP_MS}
              value={audioQuality.sendBufferMs}
              onChange={(e) => setSendBufferMs(Number(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer
                bg-[#00F0FF]/20 accent-[#00F0FF]
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#00F0FF] [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(0,240,255,0.5)]"
            />
            <div className="flex justify-between text-[8px] text-[#A0A0B0] mt-0.5">
              <span>8ms (low latency)</span>
              <span>2048ms (stable)</span>
            </div>
          </div>

          {/* Receive Buffer */}
          <div>
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-[#A0A0B0] font-['Share_Tech_Mono',monospace]">Receive Buffer</span>
              <span className="text-[#F0F0F0] font-mono">{bufferLabel(audioQuality.receiveBufferMs)}</span>
            </div>
            <input
              type="range"
              min={BUFFER_MIN_MS}
              max={BUFFER_MAX_MS}
              step={BUFFER_STEP_MS}
              value={audioQuality.receiveBufferMs}
              onChange={(e) => setReceiveBufferMs(Number(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer
                bg-[#00F0FF]/20 accent-[#00F0FF]
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#00F0FF] [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(0,240,255,0.5)]"
            />
            <div className="flex justify-between text-[8px] text-[#A0A0B0] mt-0.5">
              <span>8ms (low latency)</span>
              <span>2048ms (stable)</span>
            </div>
          </div>
        </section>

        {/* Separator */}
        <div className="border-t border-[#00F0FF]/10" />

        {/* Screen Share Section */}
        <section>
          <h3 className="text-xs font-['Share_Tech_Mono',monospace] text-[#00F0FF] uppercase tracking-wider mb-3">
            Screen Share
          </h3>

          {/* Frame Rate */}
          <div className="mb-4">
            <p className="text-[10px] text-[#A0A0B0] font-['Share_Tech_Mono',monospace] mb-2">
              Frame Rate
            </p>
            <div className="flex gap-2">
              {FPS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setScreenFps(opt.value)}
                  className={`flex-1 py-1.5 rounded text-[11px] font-['Share_Tech_Mono',monospace] transition-colors border ${
                    screenShare.frameRate === opt.value
                      ? "bg-[#00F0FF]/15 text-[#00F0FF] border-[#00F0FF]/30"
                      : "bg-white/5 text-[#A0A0B0] border-white/10 hover:bg-white/10"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Resolution */}
          <div className="mb-4">
            <p className="text-[10px] text-[#A0A0B0] font-['Share_Tech_Mono',monospace] mb-2">
              Resolution
            </p>
            <div className="flex gap-2">
              {RESOLUTION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setScreenResolution(opt.value)}
                  className={`flex-1 py-1.5 rounded text-[11px] font-['Share_Tech_Mono',monospace] transition-colors border ${
                    screenShare.resolution === opt.value
                      ? "bg-[#00F0FF]/15 text-[#00F0FF] border-[#00F0FF]/30"
                      : "bg-white/5 text-[#A0A0B0] border-white/10 hover:bg-white/10"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Bitrate */}
          <div>
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-[#A0A0B0] font-['Share_Tech_Mono',monospace]">Bitrate</span>
              <span className="text-[#F0F0F0] font-mono">{bitrateLabel(screenShare.bitrate)}</span>
            </div>
            <input
              type="range"
              min={SCREEN_BITRATE_MIN}
              max={SCREEN_BITRATE_MAX}
              step={SCREEN_BITRATE_STEP}
              value={screenShare.bitrate}
              onChange={(e) => setScreenBitrate(Number(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer
                bg-[#00F0FF]/20 accent-[#00F0FF]
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#00F0FF] [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(0,240,255,0.5)]"
            />
            <div className="flex justify-between text-[8px] text-[#A0A0B0] mt-0.5">
              <span>0.5 Mbps</span>
              <span>5 Mbps</span>
            </div>
          </div>
        </section>
      </div>
    </Modal>
  );
}
