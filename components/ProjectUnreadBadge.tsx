"use client";

import Link from "next/link";
import { useNotificationStore } from "@/lib/store/notification";

export function ProjectUnreadBadge({ projectId }: { projectId: string }) {
  const unreadByProject = useNotificationStore((s) => s.unreadByProject);

  const badge = unreadByProject[projectId] ?? 0;
  if (badge === 0) return null;

  return (
    <span className="absolute top-1 right-1 bg-[#FF4444] text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
      {badge > 99 ? "99+" : badge}
    </span>
  );
}

/** Wraps a project card with a relative container and unread badge */
export function ProjectCardWrapper({
  projectId,
  href,
  children,
}: {
  projectId: string;
  href: string;
  children: React.ReactNode;
}) {
  const badge = useNotificationStore((s) => s.unreadByProject[projectId] ?? 0);

  return (
    <Link
      href={href}
      className="relative block"
    >
      <ProjectUnreadBadge projectId={projectId} />
      {children}
    </Link>
  );
}
