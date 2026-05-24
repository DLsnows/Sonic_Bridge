import { create } from "zustand";

export interface UnreadEntry {
  total: number;
  threads: number;
  files: number;
  events: number;
}

const EMPTY_ENTRY: UnreadEntry = { total: 0, threads: 0, files: 0, events: 0 };

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
    // Optimistic local clear
    set((state) => {
      const updated = { ...state.unreadByProject };
      const entry: UnreadEntry = { ...EMPTY_ENTRY, ...updated[projectId] };
      if (tabKey === "discussion") entry.threads = 0;
      if (tabKey === "files") entry.files = 0;
      if (tabKey === "schedule") entry.events = 0;
      entry.total = entry.threads + entry.files + entry.events;
      if (entry.total > 0) updated[projectId] = entry;
      else delete updated[projectId];
      return { unreadByProject: updated };
    });
    // Server sync — await POST then refresh
    fetch("/api/notifications/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, tabKey }),
    }).then(() => get().fetchUnreadCounts()).catch(() => {});
  },
}));
