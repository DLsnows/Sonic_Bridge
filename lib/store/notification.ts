import { create } from "zustand";

export interface UnreadEntry {
  total: number;
  threads: number;
  files: number;
  events: number;
}

const STORAGE_KEY = "notif-viewed";

function loadViewed(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveViewed(v: Record<string, number>) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(v)); } catch { /* quota exceeded */ }
}

interface NotificationState {
  unreadByProject: Record<string, UnreadEntry>;
  viewedTimestamps: Record<string, number>;
  fetchUnreadCounts: () => Promise<void>;
  recordProjectView: (projectId: string) => void;
  recordTabView: (projectId: string, tabKey: string) => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  unreadByProject: {},
  viewedTimestamps: {},

  fetchUnreadCounts: async () => {
    // Restore viewed timestamps from localStorage
    const viewed = typeof window !== "undefined" ? loadViewed() : {};
    set({ viewedTimestamps: viewed });

    try {
      const res = await fetch("/api/notifications/unread-counts");
      if (res.ok) {
        const data = await res.json();
        const raw: Record<string, UnreadEntry> = data.counts ?? {};
        // Subtract viewed counts per-project
        const adjusted: Record<string, UnreadEntry> = {};
        for (const [pid, entry] of Object.entries(raw)) {
          const e = entry as UnreadEntry;
          const projectViewedAt = viewed[pid] ?? 0;
          const threadsViewedAt = Math.max(projectViewedAt, viewed[`${pid}:discussion`] ?? 0);
          const filesViewedAt = Math.max(projectViewedAt, viewed[`${pid}:files`] ?? 0);
          const eventsViewedAt = Math.max(projectViewedAt, viewed[`${pid}:schedule`] ?? 0);
          const total = Math.max(0, (e.threads - (threadsViewedAt > 0 ? e.threads : 0)) + (e.files - (filesViewedAt > 0 ? e.files : 0)) + (e.events - (eventsViewedAt > 0 ? e.events : 0)));
          const threads = Math.max(0, e.threads - (threadsViewedAt > 0 ? e.threads : 0));
          const files = Math.max(0, e.files - (filesViewedAt > 0 ? e.files : 0));
          const events = Math.max(0, e.events - (eventsViewedAt > 0 ? e.events : 0));
          if (total > 0) adjusted[pid] = { total, threads, files, events };
        }
        set({ unreadByProject: adjusted });
      }
    } catch (e) { console.error("fetchUnreadCounts failed:", e); }
  },

  recordProjectView: (projectId: string) => {
    const viewed = { ...get().viewedTimestamps };
    viewed[projectId] = Date.now();
    set({ viewedTimestamps: viewed });
    saveViewed(viewed);
    // Clear all per-tab views for this project too
    for (const tab of ["discussion", "files", "schedule"]) {
      viewed[`${projectId}:${tab}`] = Date.now();
    }
    saveViewed(viewed);
    // Re-fetch to apply the filter
    get().fetchUnreadCounts();
    // Fire server API (best-effort)
    try {
      fetch("/api/notifications/view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
    } catch { /* non-critical */ }
  },

  recordTabView: (projectId: string, tabKey: string) => {
    const viewed = { ...get().viewedTimestamps };
    viewed[`${projectId}:${tabKey}`] = Date.now();
    set({ viewedTimestamps: viewed });
    saveViewed(viewed);
    get().fetchUnreadCounts();
  },
}));
