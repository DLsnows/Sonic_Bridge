"use client";

import { useEffect, useRef } from "react";

interface VstVolumeMeterProps {
  left: number; // dBFS
  right: number; // dBFS
  peak: number; // dBFS peak hold
}

function dBToPercent(db: number): number {
  if (!isFinite(db) || db < -60) return 0;
  return Math.max(0, Math.min(100, ((db + 60) / 60) * 100));
}

function dBColor(db: number): string {
  if (!isFinite(db) || db < -60) return "#00FF41";
  if (db > -3) return "#FF4444";
  if (db > -12) return "#FFB800";
  if (db > -24) return "#00FF41";
  return "#00F0FF";
}

function formatDB(db: number): string {
  if (!isFinite(db) || db < -60) return "-∞";
  return db.toFixed(1);
}

export function VstVolumeMeter({ left, right, peak }: VstVolumeMeterProps) {
  const peakRef = useRef<number>(-Infinity);
  const decayRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (peak > peakRef.current) {
      peakRef.current = peak;
      if (decayRef.current) clearTimeout(decayRef.current);
      decayRef.current = setTimeout(() => {
        peakRef.current = -Infinity;
      }, 2000);
    }
    return () => {
      if (decayRef.current) clearTimeout(decayRef.current);
    };
  }, [peak]);

  const leftPercent = dBToPercent(left);
  const rightPercent = dBToPercent(right);
  const peakPercent = dBToPercent(peakRef.current);

  return (
    <div className="space-y-1.5">
      {/* Left channel */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-[#A0A0B0] font-['Share_Tech_Mono',monospace] w-4">
          L
        </span>
        <div className="flex-1 h-2 bg-black/60 rounded-full overflow-hidden border border-[#00FF41]/10 relative">
          <div
            className="h-full rounded-full transition-all duration-75"
            style={{
              width: `${leftPercent}%`,
              backgroundColor: dBColor(left),
              boxShadow: `0 0 6px ${dBColor(left)}40`,
            }}
          />
          {isFinite(peakRef.current) && (
            <div
              className="absolute top-0 h-full w-0.5 bg-white/80 rounded"
              style={{ left: `${peakPercent}%` }}
            />
          )}
        </div>
        <span
          className="text-[10px] font-['Share_Tech_Mono',monospace] w-14 text-right"
          style={{ color: dBColor(left) }}
        >
          {formatDB(left)}
        </span>
      </div>

      {/* Right channel */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-[#A0A0B0] font-['Share_Tech_Mono',monospace] w-4">
          R
        </span>
        <div className="flex-1 h-2 bg-black/60 rounded-full overflow-hidden border border-[#00FF41]/10 relative">
          <div
            className="h-full rounded-full transition-all duration-75"
            style={{
              width: `${rightPercent}%`,
              backgroundColor: dBColor(right),
              boxShadow: `0 0 6px ${dBColor(right)}40`,
            }}
          />
          {isFinite(peakRef.current) && (
            <div
              className="absolute top-0 h-full w-0.5 bg-white/80 rounded"
              style={{ left: `${peakPercent}%` }}
            />
          )}
        </div>
        <span
          className="text-[10px] font-['Share_Tech_Mono',monospace] w-14 text-right"
          style={{ color: dBColor(right) }}
        >
          {formatDB(right)}
        </span>
      </div>
    </div>
  );
}
