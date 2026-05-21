"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useSidebarStore } from "@/lib/store/sidebar";
import { Button } from "./ui/Button";
import { projectHref } from "@/lib/project-utils";

interface SidebarProject {
  id: string;
  name: string;
  customId: string | null;
  status: string;
}

const STATUS_DOT: Record<string, string> = {
  not_started: "bg-[#A0A0B0]",
  in_progress: "bg-[#00FF41]",
  paused: "bg-[#FFB800]",
  pending_release: "bg-[#00F0FF]",
  archived: "bg-[#FF4444]",
};

export function Sidebar({ username, avatar, projects }: { username?: string; avatar?: string | null; projects?: SidebarProject[] }) {
  const pathname = usePathname();
  const collapsed = useSidebarStore((s) => s.collapsed);
  const toggle = useSidebarStore((s) => s.toggle);
  const [lastFailedAvatar, setLastFailedAvatar] = useState<string | null>(null);
  const avatarFailed = lastFailedAvatar === avatar;

  return (
    <aside
      className={`h-screen fixed left-0 top-0 flex flex-col bg-[#0A0A0F] border-r border-[#00FF41]/10 z-30 transition-all duration-300 ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      {/* Logo */}
      <div className="p-5 border-b border-[#00FF41]/10 flex items-center gap-2">
        <Link
          href="/"
          className={`font-['Share_Tech_Mono',monospace] text-lg neon-text transition-opacity ${
            collapsed ? "opacity-0 absolute" : ""
          }`}
        >
          SONICBRIDGE
        </Link>
        <button
          onClick={toggle}
          className={`text-[#A0A0B0] hover:text-[#F0F0F0] transition-colors text-sm ${
            collapsed ? "mx-auto" : "ml-auto"
          }`}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? "▶" : "◀"}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 flex flex-col gap-1 overflow-y-auto">
        <Link
          href="/"
          className={`flex items-center rounded-lg text-sm transition-all duration-200
            ${collapsed ? "justify-center px-2 py-2" : "gap-3 px-3 py-2"}
            ${pathname === "/"
              ? "bg-[#00FF41]/10 text-[#00FF41] border border-[#00FF41]/20"
              : "text-[#A0A0B0] hover:text-[#F0F0F0] hover:bg-white/5"}`}
          title={collapsed ? "Projects" : undefined}
        >
          <span>{"◈"}</span>
          {!collapsed && "Projects"}
        </Link>
        {projects?.filter((p) => p.status !== "archived").map((project) => {
          const href = projectHref(project);
          const isActive = pathname.startsWith(href);
          return (
            <Link
              key={project.id}
              href={href}
              className={`flex items-center rounded-lg text-sm transition-all duration-200
                ${collapsed ? "justify-center px-2 py-2" : "gap-2 px-3 py-2"}
                ${isActive
                  ? "bg-[#00FF41]/10 text-[#00FF41] border border-[#00FF41]/20"
                  : "text-[#A0A0B0] hover:text-[#F0F0F0] hover:bg-white/5"}`}
              title={collapsed ? project.name : undefined}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[project.status] || STATUS_DOT.in_progress}`} />
              {!collapsed && <span className="truncate">{project.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className={`p-4 border-t border-[#00FF41]/10 flex items-center ${collapsed ? "justify-center" : "gap-3"}`}>
        <Link
          href="/settings"
          className={`flex items-center min-w-0 hover:bg-white/5 rounded-lg p-1 -m-1 transition-colors ${
            collapsed ? "gap-0" : "gap-3 flex-1"
          }`}
        >
          {avatar && !avatarFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`${avatar}${avatar.includes("?") ? "&" : "?"}name=${encodeURIComponent(username ?? "User")}`}
              alt={username ?? "User"}
              className="w-8 h-8 rounded-full object-cover border border-[#00FF41]/20 shrink-0"
              referrerPolicy="no-referrer"
              onError={() => setLastFailedAvatar(avatar)}
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-[#00FF41]/20 flex items-center justify-center text-xs text-[#00FF41] font-['Share_Tech_Mono',monospace] shrink-0">
              {(username || "U")[0].toUpperCase()}
            </div>
          )}
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[#F0F0F0] truncate">{username ?? "User"}</p>
            </div>
          )}
        </Link>
        {!collapsed && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="Sign out"
          >
            {"⏻"}
          </Button>
        )}
      </div>
    </aside>
  );
}
