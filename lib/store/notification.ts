import { create } from "zustand";

interface UnreadEntry {
  total: number;
  threads: number;
  files: number;
  events: number;
}

interface NotificationState {
  unreadByProject: Record<string, UnreadEntry>;
  fetchUnreadCounts: () => Promise<void>;
  recordProjectView: (projectId: string) => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set) => ({
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

  recordProjectView: async (projectId: string) => {
    set((state) => {
      const updated = { ...state.unreadByProject };
      delete updated[projectId];
      return { unreadByProject: updated };
    });
    try {
      await fetch("/api/notifications/view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
    } catch (e) { console.error("recordProjectView failed:", e); }
  },
}));
