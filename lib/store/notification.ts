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
  viewedTimestamps: Record<string, number>;
  fetchUnreadCounts: () => Promise<void>;
  recordTabView: (projectId: string, tabKey: string) => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  unreadByProject: {},
  viewedTimestamps: {},

  fetchUnreadCounts: async () => {
    const viewed = typeof window !== "undefined" ? loadViewed() : {};
    set({ viewedTimestamps: viewed });
    try {
      const res = await fetch("/api/notifications/unread-counts");
      if (res.ok) {
        const data = await res.json();
        const raw: Record<string, UnreadEntry> = data.counts ?? {};
        const adjusted: Record<string, UnreadEntry> = {};
        for (const [pid, entry] of Object.entries(raw)) {
          const e = entry as UnreadEntry;
          const pv = viewed[pid] ?? 0;
          const tv = Math.max(pv, viewed[`${pid}:discussion`] ?? 0);
          const fv = Math.max(pv, viewed[`${pid}:files`] ?? 0);
          const ev = Math.max(pv, viewed[`${pid}:schedule`] ?? 0);
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
    const viewed = { ...get().viewedTimestamps };
    viewed[`${projectId}:${tabKey}`] = Date.now();
    viewed[projectId] = Date.now();
    set({ viewedTimestamps: viewed });
    saveViewed(viewed);
    get().fetchUnreadCounts();
  },
}));
