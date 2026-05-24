"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useSidebarStore, type SidebarProject } from "@/lib/store/sidebar";
import { Button } from "./ui/Button";
import { projectHref } from "@/lib/project-utils";
import { NotificationBellInline } from "./NotificationBell";
import { useNotificationStore } from "@/lib/store/notification";

const STATUS_DOT: Record<string, string> = {
  not_started: "bg-[#A0A0B0]",
  in_progress: "bg-[#00FF41]",
  paused: "bg-[#FFB800]",
  pending_release: "bg-[#00F0FF]",
  archived: "bg-[#FF4444]",
};

export function Sidebar({ username, projects }: { username?: string; projects?: SidebarProject[] }) {
  const pathname = usePathname();
  const collapsed = useSidebarStore((s) => s.collapsed);
  const toggle = useSidebarStore((s) => s.toggle);
  const storeProjects = useSidebarStore((s) => s.projects);
  const setProjects = useSidebarStore((s) => s.setProjects);
  const refreshProjects = useSidebarStore((s) => s.refreshProjects);
  const unreadByProject = useNotificationStore((s) => s.unreadByProject);

  // Initialize store from server props on first render
  useEffect(() => {
    if (projects && projects.length > 0 && storeProjects.length === 0) {
      setProjects(projects);
    }
  }, [projects, setProjects, storeProjects.length]);

  // Listen for project status changes and new project creation
  useEffect(() => {
    const handler = () => {
      refreshProjects();
    };
    window.addEventListener("project-status-changed", handler);
    window.addEventListener("project-created", handler);
    return () => {
      window.removeEventListener("project-status-changed", handler);
      window.removeEventListener("project-created", handler);
    };
  }, [refreshProjects]);

  const displayProjects = storeProjects.length > 0 ? storeProjects : (projects ?? []);

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
          className={`z-10 relative text-[#A0A0B0] hover:text-[#F0F0F0] transition-colors text-sm ${
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
        {displayProjects.filter((p) => p.status !== "archived").map((project) => {
          const href = projectHref(project);
          const isActive = pathname.startsWith(href);
          const badge = unreadByProject[project.id]?.total ?? 0;
          return (
            <Link
              key={project.id}
              href={href}
              className={`flex items-center rounded-lg text-sm transition-all duration-200 relative
                ${collapsed ? "justify-center px-2 py-2" : "gap-2 px-3 py-2"}
                ${isActive
                  ? "bg-[#00FF41]/10 text-[#00FF41] border border-[#00FF41]/20"
                  : "text-[#A0A0B0] hover:text-[#F0F0F0] hover:bg-white/5"}`}
              title={collapsed ? project.name : undefined}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[project.status] || STATUS_DOT.in_progress}`} />
              {!collapsed && <span className="truncate">{project.name}</span>}
              {badge > 0 && (
                <span className={`absolute rounded-full bg-[#FF4444] text-white text-[9px] font-bold flex items-center justify-center
                  ${collapsed ? "-top-0.5 -right-0.5 w-4 h-4" : "right-1 top-1/2 -translate-y-1/2 w-4 h-4"}`}>
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
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
          <div className="w-8 h-8 rounded-full bg-[#00FF41]/20 flex items-center justify-center text-xs text-[#00FF41] font-['Share_Tech_Mono',monospace] shrink-0">
            {(username || "U")[0].toUpperCase()}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[#F0F0F0] truncate">{username ?? "User"}</p>
            </div>
          )}
        </Link>
        {!collapsed && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="Sign out"
          >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
              <line x1="12" y1="2" x2="12" y2="12" />
            </svg>
          </Button>
        )}
      </div>
    </aside>
  );
}
