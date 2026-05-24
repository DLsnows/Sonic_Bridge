"use client";

import { useNotificationStore } from "@/lib/store/notification";

const tabMap: Record<string, keyof { threads: number; files: number; events: number }> = {
  discussion: "threads",
  files: "files",
  schedule: "events",
};

export function NavBadge({ projectId, href }: { projectId: string; href: string }) {
  const entry = useNotificationStore((s) => s.unreadByProject[projectId]);
  const recordTabView = useNotificationStore((s) => s.recordTabView);
  const key = Object.entries(tabMap).find(([h]) => href.endsWith(h))?.[1];
  const count = key ? (entry?.[key] ?? 0) : 0;
  if (count === 0) return null;
  return (
    <span
      className="absolute top-2 right-2 bg-[#FF4444] text-white text-[10px] font-bold rounded-full min-w-[20px] h-[20px] flex items-center justify-center px-1.5 z-10 cursor-pointer"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const tab = Object.entries(tabMap).find(([h]) => href.endsWith(h))?.[0];
        if (tab) recordTabView(projectId, tab);
      }}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
