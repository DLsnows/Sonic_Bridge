"use client";

import { useEffect } from "react";
import { useNotificationStore } from "@/lib/store/notification";
import { useRouter } from "next/navigation";

const TYPE_LABELS: Record<string, string> = {
  new_post: "New thread",
  new_reply: "New reply",
  reply_to_user: "Someone replied",
  new_event: "New event",
  new_file: "New file",
};

const TYPE_ICONS: Record<string, string> = {
  new_post: "💬",
  new_reply: "↩",
  reply_to_user: "@",
  new_event: "📅",
  new_file: "📁",
};

function jumpUrl(n: { projectId: string; referenceType: string; referenceId: string }): string {
  switch (n.referenceType) {
    case "discussion_post":
      return `/projects/${n.projectId}/discussion?post=${n.referenceId}`;
    case "schedule_event":
      return `/projects/${n.projectId}/schedule?event=${n.referenceId}`;
    case "file":
      return `/projects/${n.projectId}/files?file=${n.referenceId}`;
    default:
      return "/";
  }
}

export function NotificationBell() {
  const router = useRouter();
  const {
    notifications,
    unreadCount,
    dropdownOpen,
    setDropdownOpen,
    markRead,
    markAllRead,
    fetchNotifications,
  } = useNotificationStore();

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleClick = (n: typeof notifications[0]) => {
    if (!n.isRead) markRead(n.id);
    const url = jumpUrl(n);
    router.push(url);
    setDropdownOpen(false);
  };

  return (
    <div className="fixed top-4 right-4 z-50">
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="relative bg-[#0A0A0F] border border-[#00FF41]/20 rounded-full w-10 h-10 flex items-center justify-center hover:border-[#00FF41]/50 transition-colors"
      >
        <span className="text-lg">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-[#FF4444] text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 99 ? "99" : unreadCount}
          </span>
        )}
      </button>

      {dropdownOpen && (
        <div className="absolute top-12 right-0 w-80 bg-[#0A0A0F] border border-white/10 rounded-lg shadow-xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <h3 className="text-sm text-[#F0F0F0] font-['Share_Tech_Mono',monospace]">
              Notifications
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead()}
                className="text-[10px] text-[#FF8C00] hover:text-[#FF8C00]/80 font-mono"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-xs text-[#A0A0B0] text-center py-8">No notifications</p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`flex items-start gap-3 px-4 py-2.5 border-b border-white/5 cursor-pointer hover:bg-white/[0.03] transition-colors ${
                    !n.isRead ? "bg-[#00FF41]/[0.02]" : ""
                  }`}
                >
                  <span className="text-sm mt-0.5">{TYPE_ICONS[n.type] || "•"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[#D0D0D0]">
                      {TYPE_LABELS[n.type] || n.type}
                    </p>
                    <p className="text-[10px] text-[#A0A0B0]/60 mt-0.5">
                      {new Date(n.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {!n.isRead && (
                    <button
                      onClick={(e) => { e.stopPropagation(); markRead(n.id); }}
                      className="text-[10px] text-[#A0A0B0]/40 hover:text-[#A0A0B0] shrink-0 mt-0.5"
                      title="Mark read"
                    >
                      ✓
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
