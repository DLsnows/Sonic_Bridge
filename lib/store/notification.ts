import { create } from "zustand";

export interface UnreadEntry {
  total: number;
  threads: number;
  files: number;
  events: number;
}

const STORAGE_KEY = "notif-viewed";
function loadViewed(): Record<string, number> {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}
function saveViewed(v: Record<string, number>) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(v)); } catch { /* quota */ }
}

interface NotificationState {
  unreadByProject: Record<string, UnreadEntry>;
  fetchUnreadCounts: () => Promise<void>;
  recordTabView: (projectId: string, tabKey: string) => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  unreadByProject: {},

  fetchUnreadCounts: async () => {
    const viewed = typeof window !== "undefined" ? loadViewed() : {};
    try {
      const res = await fetch("/api/notifications/unread-counts");
      if (res.ok) {
        const data = await res.json();
        const raw: Record<string, UnreadEntry> = data.counts ?? {};
        const adjusted: Record<string, UnreadEntry> = {};
        for (const [pid, entry] of Object.entries(raw)) {
          const e = entry as UnreadEntry;
          const tv = viewed[`${pid}:discussion`] ?? 0;
          const fv = viewed[`${pid}:files`] ?? 0;
          const ev = viewed[`${pid}:schedule`] ?? 0;
          const threads = tv > 0 ? 0 : e.threads;
          const files = fv > 0 ? 0 : e.files;
          const events = ev > 0 ? 0 : e.events;
          const total = threads + files + events;
          if (total > 0) adjusted[pid] = { total, threads, files, events };
        }
        set({ unreadByProject: adjusted });
      }
    } catch (e) { console.error("fetchUnreadCounts failed:", e); }
  },

  recordTabView: (projectId: string, tabKey: string) => {
    const viewed = loadViewed();
    viewed[`${projectId}:${tabKey}`] = Date.now();
    saveViewed(viewed);
    get().fetchUnreadCounts();
    // Best-effort server sync
    fetch("/api/notifications/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId }),
    }).catch(() => {});
  },
}));
