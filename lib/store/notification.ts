import { create } from "zustand";

export interface UnreadEntry {
  total: number;
  threads: number;
  files: number;
  events: number;
}

interface NotificationState {
  unreadByProject: Record<string, UnreadEntry>;
  fetchUnreadCounts: () => Promise<void>;
  recordTabView: (projectId: string, tabKey: string) => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  unreadByProject: {},

  fetchUnreadCounts: async () => {
    try {
      const res = await fetch("/api/notifications/unread-counts");
      if (res.ok) {
        const data = await res.json();
        set({ unreadByProject: data.counts ?? {} });
      }
    } catch (e) { console.error("fetchUnreadCounts failed:", e); }
  },

  recordTabView: (projectId: string, tabKey: string) => {
    // Optimistic local clear — remove this tab's count immediately
    set((state) => {
      const updated = { ...state.unreadByProject };
      const entry = { ...updated[projectId] } as UnreadEntry;
      if (tabKey === "discussion") entry.threads = 0;
      if (tabKey === "files") entry.files = 0;
      if (tabKey === "schedule") entry.events = 0;
      entry.total = entry.threads + entry.files + entry.events;
      if (entry.total > 0) updated[projectId] = entry;
      else delete updated[projectId];
      return { unreadByProject: updated };
    });
    // Server sync — updates project_views.last_viewed_at so future polls exclude old content
    fetch("/api/notifications/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId }),
    }).catch(() => {});
    // Refresh from server to get accurate counts
    get().fetchUnreadCounts();
  },
}));
