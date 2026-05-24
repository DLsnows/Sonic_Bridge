"use client";

import { useMediaSettingsStore, msToSamples, type VideoFps, type VideoResolution, type ScreenResolution, type NoiseMode } from "@/lib/store/media-settings";
import { Modal } from "@/components/ui/Modal";

interface MediaSettingsPanelProps { open: boolean; onClose: () => void; }

const BITRATE_STEP = 16000;
const BITRATE_MIN = 192000;
const BITRATE_MAX = 510000;
const BUFFER_MIN_MS = 8;
const BUFFER_MAX_MS = 2048;
const BUFFER_STEP_MS = 8;

const VIDEO_BITRATE_MIN = 500_000;
const VIDEO_BITRATE_MAX = 5_000_000;
const VIDEO_BITRATE_STEP = 250_000;

const FPS_OPTIONS: { label: string; value: VideoFps }[] = [
  { label: "15 fps", value: 15 },
  { label: "30 fps", value: 30 },
  { label: "60 fps", value: 60 },
];

const CAM_RES_OPTIONS: { label: string; value: VideoResolution }[] = [
  { label: "720p", value: "720p" },
  { label: "1080p", value: "1080p" },
];

const SCREEN_RES_OPTIONS: { label: string; value: ScreenResolution }[] = [
  { label: "720p", value: "720p" },
  { label: "1080p", value: "1080p" },
  { label: "Original", value: "original" },
];

const NOISE_OPTIONS: { label: string; value: NoiseMode }[] = [
  { label: "Off", value: "off" },
  { label: "Suppression", value: "suppression" },
  { label: "Voice Iso (Chrome)", value: "voiceIsolation" },
];

function bufferLabel(ms: number): string { return `${ms}ms (${msToSamples(ms)} smp)`; }
function bitrateLabel(bps: number): string {
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} Mbps`;
  return `${Math.round(bps / 1000)} kbps`;
}

const sliderClass = "w-full h-1.5 rounded-full appearance-none cursor-pointer bg-[#00F0FF]/20 accent-[#00F0FF] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#00F0FF] [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(0,240,255,0.5)]";

function SectionHeader({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xs font-['Share_Tech_Mono',monospace] text-[#00F0FF] uppercase tracking-wider mb-3">{children}</h3>;
}

function OptionGroup({ options, value, onChange }: { options: { label: string; value: string | number }[]; value: string | number; onChange: (v: string | number) => void }) {
  return (
    <div className="flex gap-2">
      {options.map((opt) => (
        <button key={opt.value} onClick={() => onChange(opt.value)}
          className={`flex-1 py-1.5 rounded text-[11px] font-['Share_Tech_Mono',monospace] transition-colors border ${
            value === opt.value ? "bg-[#00F0FF]/15 text-[#00F0FF] border-[#00F0FF]/30" : "bg-white/5 text-[#A0A0B0] border-white/10 hover:bg-white/10"
          }`}>{opt.label}</button>
      ))}
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange, minLabel, maxLabel }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; minLabel?: string; maxLabel?: string;
}) {
  return (
    <div className="mb-3">
      <div className="flex justify-between text-[10px] mb-1">
        <span className="text-[#A0A0B0] font-['Share_Tech_Mono',monospace]">{label}</span>
        <span className="text-[#F0F0F0] font-mono">{label.includes("Buffer") ? bufferLabel(value) : bitrateLabel(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className={sliderClass} />
      {minLabel && <div className="flex justify-between text-[8px] text-[#A0A0B0] mt-0.5"><span>{minLabel}</span><span>{maxLabel}</span></div>}
    </div>
  );
}

export function MediaSettingsPanel({ open, onClose }: MediaSettingsPanelProps) {
  const audioQuality = useMediaSettingsStore((s) => s.audioQuality);
  const camera = useMediaSettingsStore((s) => s.camera);
  const screenShare = useMediaSettingsStore((s) => s.screenShare);
  const setAudioBitrate = useMediaSettingsStore((s) => s.setAudioBitrate);
  const setSendBufferMs = useMediaSettingsStore((s) => s.setSendBufferMs);
  const setReceiveBufferMs = useMediaSettingsStore((s) => s.setReceiveBufferMs);
  const setNoiseMode = useMediaSettingsStore((s) => s.setNoiseMode);
  const setCameraFps = useMediaSettingsStore((s) => s.setCameraFps);
  const setCameraResolution = useMediaSettingsStore((s) => s.setCameraResolution);
  const setCameraBitrate = useMediaSettingsStore((s) => s.setCameraBitrate);
  const setScreenFps = useMediaSettingsStore((s) => s.setScreenFps);
  const setScreenResolution = useMediaSettingsStore((s) => s.setScreenResolution);
  const setScreenBitrate = useMediaSettingsStore((s) => s.setScreenBitrate);

  return (
    <Modal open={open} onClose={onClose} title="Media Quality Settings">
      <div className="space-y-6">
        {/* Microphone */}
        <section>
          <SectionHeader>Microphone</SectionHeader>
          <Slider label="Opus Bitrate" value={audioQuality.bitrate} min={BITRATE_MIN} max={BITRATE_MAX} step={BITRATE_STEP} onChange={setAudioBitrate} />
          <Slider label="Send Buffer" value={audioQuality.sendBufferMs} min={BUFFER_MIN_MS} max={BUFFER_MAX_MS} step={BUFFER_STEP_MS} onChange={setSendBufferMs} />
          <Slider label="Receive Buffer" value={audioQuality.receiveBufferMs} min={BUFFER_MIN_MS} max={BUFFER_MAX_MS} step={BUFFER_STEP_MS} onChange={setReceiveBufferMs} />
          <div>
            <p className="text-[10px] text-[#A0A0B0] font-['Share_Tech_Mono',monospace] mb-2">Noise Reduction</p>
            <div className="flex gap-1.5">
              {NOISE_OPTIONS.map((opt) => (
                <button key={opt.value} onClick={() => setNoiseMode(opt.value)}
                  className={`flex-1 py-1.5 rounded text-[10px] font-['Share_Tech_Mono',monospace] transition-colors border ${
                    audioQuality.noiseMode === opt.value
                      ? opt.value === "voiceIsolation" ? "bg-[#B44DFF]/15 text-[#B44DFF] border-[#B44DFF]/30"
                        : opt.value === "suppression" ? "bg-[#00FF41]/15 text-[#00FF41] border-[#00FF41]/30"
                        : "bg-white/10 text-[#F0F0F0] border-white/20"
                      : "bg-white/[0.02] text-[#A0A0B0] border-white/5 hover:bg-white/5"
                  }`}>{opt.label}</button>
              ))}
            </div>
          </div>
        </section>

        <div className="border-t border-[#00F0FF]/10" />

        {/* Camera */}
        <section>
          <SectionHeader>Camera</SectionHeader>
          <div className="mb-3">
            <p className="text-[10px] text-[#A0A0B0] font-['Share_Tech_Mono',monospace] mb-2">Frame Rate</p>
            <OptionGroup options={FPS_OPTIONS} value={camera.frameRate} onChange={(v) => setCameraFps(Number(v) as VideoFps)} />
          </div>
          <div className="mb-3">
            <p className="text-[10px] text-[#A0A0B0] font-['Share_Tech_Mono',monospace] mb-2">Resolution</p>
            <OptionGroup options={CAM_RES_OPTIONS} value={camera.resolution} onChange={(v) => setCameraResolution(v as VideoResolution)} />
          </div>
          <Slider label="Bitrate" value={camera.bitrate} min={VIDEO_BITRATE_MIN} max={VIDEO_BITRATE_MAX} step={VIDEO_BITRATE_STEP} onChange={setCameraBitrate} minLabel="0.5 Mbps" maxLabel="5 Mbps" />
        </section>

        <div className="border-t border-[#00F0FF]/10" />

        {/* Screen Share */}
        <section>
          <SectionHeader>Screen Share</SectionHeader>
          <div className="mb-3">
            <p className="text-[10px] text-[#A0A0B0] font-['Share_Tech_Mono',monospace] mb-2">Frame Rate</p>
            <OptionGroup options={FPS_OPTIONS} value={screenShare.frameRate} onChange={(v) => setScreenFps(Number(v) as VideoFps)} />
          </div>
          <div className="mb-3">
            <p className="text-[10px] text-[#A0A0B0] font-['Share_Tech_Mono',monospace] mb-2">Resolution</p>
            <OptionGroup options={SCREEN_RES_OPTIONS} value={screenShare.resolution} onChange={(v) => setScreenResolution(v as ScreenResolution)} />
          </div>
          <Slider label="Bitrate" value={screenShare.bitrate} min={VIDEO_BITRATE_MIN} max={VIDEO_BITRATE_MAX} step={VIDEO_BITRATE_STEP} onChange={setScreenBitrate} minLabel="0.5 Mbps" maxLabel="5 Mbps" />
        </section>
      </div>
    </Modal>
  );
}
