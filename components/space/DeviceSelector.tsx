"use client";

import { useState, useEffect } from "react";

interface DeviceInfo {
  deviceId: string;
  label: string;
}

interface DeviceSelectorProps {
  kind: "audioinput" | "videoinput";
  currentDeviceId: string | null;
  onSelect: (deviceId: string) => void;
  onClose: () => void;
}

export function DeviceSelector({ kind, currentDeviceId, onSelect, onClose }: DeviceSelectorProps) {
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadDevices() {
      try {
        try {
          const constraints = kind === "audioinput"
            ? { audio: true }
            : { video: true };
          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          stream.getTracks().forEach((t) => t.stop());
        } catch { /* labels may be empty */ }

        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const filtered = allDevices
          .filter((d) => d.kind === kind && d.deviceId)
          .map((d) => ({
            deviceId: d.deviceId,
            label: d.label || `${kind === "audioinput" ? "Microphone" : "Camera"} (${d.deviceId.slice(0, 8)}...)`,
          }));

        const seen = new Set<string>();
        const unique: DeviceInfo[] = [];
        for (const d of filtered) {
          if (!seen.has(d.deviceId)) {
            seen.add(d.deviceId);
            unique.push(d);
          }
        }
        if (!cancelled) setDevices(unique);
      } catch {
        // no devices available
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadDevices();
    return () => { cancelled = true; };
  }, [kind]);

  return (
    <div className="absolute bottom-full left-0 mb-2 bg-[#0A0A0F] border border-[#00F0FF]/20 rounded-lg shadow-xl py-1 min-w-[200px] z-50 backdrop-blur-xl">
      <div className="px-3 py-1 text-[10px] text-[#A0A0B0] uppercase tracking-wider font-['Share_Tech_Mono',monospace]">
        {kind === "audioinput" ? "Input Device" : "Camera"}
      </div>
      {loading && (
        <div className="px-3 py-2 text-[10px] text-[#A0A0B0]">Loading devices...</div>
      )}
      {!loading && devices.length === 0 && (
        <div className="px-3 py-2 text-[10px] text-[#A0A0B0]">No devices found</div>
      )}
      {devices.map((device) => (
        <button
          key={device.deviceId}
          className={`w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-[#00F0FF]/10 ${
            device.deviceId === currentDeviceId ? "text-[#00F0FF]" : "text-[#F0F0F0]"
          }`}
          onClick={() => onSelect(device.deviceId)}
        >
          <span className="truncate block">{device.label}</span>
        </button>
      ))}
      <button
        className="w-full text-left px-3 py-1.5 text-[10px] text-[#A0A0B0] hover:bg-white/5 transition-colors border-t border-[#00F0FF]/10"
        onClick={onClose}
      >
        Cancel
      </button>
    </div>
  );
}
