"use client";

import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/Button";
import { GlassPanel } from "@/components/ui/GlassPanel";

interface ScheduleEvent {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  type: "meeting" | "production" | "release" | "other";
  createdBy: string;
  createdAt: string;
  creatorName: string;
  creatorAvatar?: string | null;
}

const typeConfig: Record<
  string,
  { color: string; bg: string; border: string; label: string }
> = {
  meeting: {
    color: "#00F0FF",
    bg: "rgba(0,240,255,0.05)",
    border: "border-[#00F0FF]/30",
    label: "Meeting",
  },
  production: {
    color: "#00FF41",
    bg: "rgba(0,255,65,0.05)",
    border: "border-[#00FF41]/30",
    label: "Production",
  },
  release: {
    color: "#B44DFF",
    bg: "rgba(180,77,255,0.05)",
    border: "border-[#B44DFF]/30",
    label: "Release",
  },
  other: {
    color: "#A0A0B0",
    bg: "rgba(160,160,176,0.05)",
    border: "border-[#A0A0B0]/20",
    label: "Other",
  },
};

interface EventItemProps {
  event: ScheduleEvent;
  canEdit: boolean;
  onEdit: (event: ScheduleEvent) => void;
  onDelete: (eventId: string) => void;
}

export function EventItem({ event, canEdit, onEdit, onDelete }: EventItemProps) {
  const cfg = typeConfig[event.type];
  const start = parseISO(event.startTime);
  const end = parseISO(event.endTime);

  return (
    <GlassPanel glow="none" className="overflow-hidden">
      <div
        className="border-l-2 pl-3"
        style={{ borderLeftColor: cfg.color }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h4 className="text-sm text-[#F0F0F0] font-['Fira_Code',monospace] truncate">
              {event.title}
            </h4>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-[10px] text-[#A0A0B0] font-['Fira_Code',monospace]">
                {format(start, "MMM d, HH:mm")} — {format(end, "HH:mm")}
              </span>
              <span
                className="text-[9px] px-1.5 py-0.5 rounded-full font-['Share_Tech_Mono',monospace]"
                style={{ color: cfg.color, backgroundColor: cfg.bg }}
              >
                {cfg.label}
              </span>
            </div>
            {event.description && (
              <p className="text-xs text-[#A0A0B0] mt-1.5 line-clamp-2">
                {event.description}
              </p>
            )}
            <div className="flex items-center gap-1.5 mt-1">
              {event.creatorAvatar ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={`/api/user/avatar/${event.createdBy}`}
                  alt={event.creatorName}
                  className="w-4 h-4 rounded-full object-cover shrink-0"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="w-4 h-4 rounded-full bg-[#A0A0B0]/20 flex items-center justify-center text-[7px] text-[#A0A0B0]/60 font-['Share_Tech_Mono',monospace] shrink-0">
                  {event.creatorName.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="text-[10px] text-[#A0A0B0]/60">by {event.creatorName}</span>
            </div>
          </div>

          {canEdit && (
            <div className="flex gap-1 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(event)}
                title="Edit"
              >
                ✎
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(event.id)}
                title="Delete"
                className="hover:!text-[#FF4444]"
              >
                ✕
              </Button>
            </div>
          )}
        </div>
      </div>
    </GlassPanel>
  );
}
