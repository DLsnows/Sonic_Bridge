"use client";

import Link from "next/link";
import { useNotificationStore } from "@/lib/store/notification";
import { Card } from "@/components/ui/Card";

const tabMap: Record<string, keyof { threads: number; files: number; events: number }> = {
  discussion: "threads",
  files: "files",
  schedule: "events",
};

export function NavCardLink({
  projectId, href, label, desc, icon, glow,
}: {
  projectId: string; href: string; label: string; desc: string; icon: string;
  glow: "cyan" | "green" | "purple" | "orange";
}) {
  const entry = useNotificationStore((s) => s.unreadByProject[projectId]);
  const recordTabView = useNotificationStore((s) => s.recordTabView);
  const key = Object.entries(tabMap).find(([h]) => href.endsWith(h))?.[1];
  const tab = Object.entries(tabMap).find(([h]) => href.endsWith(h))?.[0];
  const count = key ? (entry?.[key] ?? 0) : 0;

  return (
    <Link
      href={`/projects/${projectId}/${href}`}
      className="relative"
      onClick={() => { if (count > 0 && tab) recordTabView(projectId, tab); }}
    >
      {count > 0 && (
        <span className="absolute top-2 right-2 bg-[#FF4444] text-white text-[10px] font-bold rounded-full min-w-[20px] h-[20px] flex items-center justify-center px-1.5 z-10">
          {count > 99 ? "99+" : count}
        </span>
      )}
      <Card hover glow={glow} className="h-full group">
        <div className="flex items-start gap-4">
          <span className="text-2xl mt-1">{icon}</span>
          <div>
            <h3 className="font-['Share_Tech_Mono',monospace] text-[#F0F0F0] text-lg mb-1">{label}</h3>
            <p className="text-sm text-[#A0A0B0]">{desc}</p>
          </div>
        </div>
      </Card>
    </Link>
  );
}
