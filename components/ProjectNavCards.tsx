"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useNotificationStore } from "@/lib/store/notification";
import { Card } from "@/components/ui/Card";

const navCards = [
  { href: "space", label: "Creative Space", desc: "Real-time audio, screen sharing, voice & video", icon: "◈", glow: "cyan" as const, countKey: null as null },
  { href: "files", label: "Project Files", desc: "Upload, download & manage project assets", icon: "◫", glow: "green" as const, countKey: "files" as const },
  { href: "schedule", label: "Schedule", desc: "Meetings, production cycles, release dates", icon: "◷", glow: "purple" as const, countKey: "events" as const },
  { href: "discussion", label: "Discussion", desc: "Ideas, feedback & team conversations", icon: "☰", glow: "orange" as const, countKey: "threads" as const },
];

export function ProjectNavCards({ projectId }: { projectId: string }) {
  const unreadByProject = useNotificationStore((s) => s.unreadByProject);
  const fetchUnreadCounts = useNotificationStore((s) => s.fetchUnreadCounts);
  const entry = unreadByProject[projectId];

  // Fetch on mount so badges show immediately (don't wait for Sidebar poll)
  useEffect(() => { fetchUnreadCounts(); }, [fetchUnreadCounts]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
      {navCards.map((card) => {
        const count = card.countKey ? (entry?.[card.countKey] ?? 0) : 0;
        return (
          <Link key={card.href} href={`/projects/${projectId}/${card.href}`} className="relative">
            <Card hover glow={card.glow} className="h-full group">
              <div className="flex items-start gap-4">
                <span className="text-2xl mt-1">{card.icon}</span>
                <div>
                  <h3 className="font-['Share_Tech_Mono',monospace] text-[#F0F0F0] text-lg mb-1">
                    {card.label}
                  </h3>
                  <p className="text-sm text-[#A0A0B0]">{card.desc}</p>
                </div>
              </div>
            </Card>
            {count > 0 && (
              <span className="absolute top-2 right-2 bg-[#FF4444] text-white text-[10px] font-bold rounded-full min-w-[20px] h-[20px] flex items-center justify-center px-1.5 z-10">
                {count > 99 ? "99+" : count}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
