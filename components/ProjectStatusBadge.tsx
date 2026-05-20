"use client";
import { useState } from "react";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  not_started: { label: "Not Started", color: "#A0A0B0", bg: "bg-[#A0A0B0]/10" },
  in_progress: { label: "In Progress", color: "#00FF41", bg: "bg-[#00FF41]/10" },
  paused: { label: "Paused", color: "#FFB800", bg: "bg-[#FFB800]/10" },
  pending_release: { label: "Pending Release", color: "#00F0FF", bg: "bg-[#00F0FF]/10" },
  archived: { label: "Archived", color: "#FF4444", bg: "bg-[#FF4444]/10" },
};

export function ProjectStatusBadge({ status, isAdmin, projectId }: {
  status: string; isAdmin: boolean; projectId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(status);
  const config = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.not_started;

  const handleStatusChange = async (newStatus: string) => {
    if (!projectId) return;
    setCurrentStatus(newStatus);
    setOpen(false);
    await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
  };

  const badge = (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-['Share_Tech_Mono',monospace] ${config.bg}`}
      style={{ color: config.color, border: `1px solid ${config.color}30` }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: config.color }} />
      {config.label}
    </span>
  );

  if (!isAdmin || !projectId) return badge;

  return (
    <div className="relative inline-block">
      <button onClick={() => setOpen(!open)} className="cursor-pointer">
        {badge}
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-[#0A0A0F] border border-white/10 rounded-lg shadow-lg z-50 py-1 min-w-[160px]"
          onMouseLeave={() => setOpen(false)}>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <button key={key} onClick={() => handleStatusChange(key)}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-white/5 flex items-center gap-2 ${currentStatus === key ? "bg-white/5" : ""}`}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.color }} />
              <span style={{ color: cfg.color }}>{cfg.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
