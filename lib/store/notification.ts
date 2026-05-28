import { create } from "zustand";

export interface Notification {
  id: string;
  projectId: string;
  type: string;
  referenceId: string;
  referenceType: string;
  isRead: boolean;
  createdAt: string;
  title?: string;
  actorName?: string;
}

export interface UnreadEntry {
  total: number;
  threads: number;
  files: number;
  events: number;
}

const STORAGE_KEY = "notif-dismissed";

function loadDismissed(): Record<string, UnreadEntry> {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}
function saveDismissed(v: Record<string, UnreadEntry>) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(v)); } catch { /* quota */ }
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  unreadByProject: Record<string, UnreadEntry>;
  dropdownOpen: boolean;
  setNotifications: (items: Notification[]) => void;
  setDropdownOpen: (open: boolean) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  fetchNotifications: () => Promise<void>;
  fetchUnreadCounts: () => Promise<void>;
  recordProjectView: (projectId: string) => void;
  recordTabView: (projectId: string, tabKey: string) => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  unreadByProject: {},
  dropdownOpen: false,

  setNotifications: (items) =>
    set({ notifications: items, unreadCount: items.filter((n) => !n.isRead).length }),

  setDropdownOpen: (open) => set({ dropdownOpen: open }),

  markRead: async (id) => {
    const notif = get().notifications.find((n) => n.id === id);
    if (notif && notif.type !== "reply_to_user" && notif.type !== "new_post") {
      set((state) => {
        const updated = state.notifications.map((n) => n.id === id ? { ...n, isRead: true } : n);
        return { notifications: updated, unreadCount: updated.filter((n) => !n.isRead).length };
      });
      return;
    }
    await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notificationId: id }) });
    set((state) => {
      const updated = state.notifications.map((n) => n.id === id ? { ...n, isRead: true } : n);
      return { notifications: updated, unreadCount: updated.filter((n) => !n.isRead).length };
    });
  },

  markAllRead: async () => {
    const projectIds = Object.keys(get().unreadByProject);
    set((state) => ({ notifications: state.notifications.map((n) => ({ ...n, isRead: true })), unreadCount: 0, unreadByProject: {} }));
    try {
      await fetch("/api/notifications", { method: "PATCH" });
      if (projectIds.length > 0) {
        await fetch("/api/notifications/view", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectIds }) });
      }
    } catch (e) { console.error("markAllRead failed:", e); }
  },

  fetchNotifications: async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) { const data = await res.json(); get().setNotifications(data.notifications); }
    } catch (e) { console.error("fetchNotifications failed:", e); }
  },

  fetchUnreadCounts: async () => {
    const dismissed = typeof window !== "undefined" ? loadDismissed() : {};
    try {
      const res = await fetch("/api/notifications/unread-counts");
      if (res.ok) {
        const data = await res.json();
        const raw: Record<string, UnreadEntry> = data.counts ?? {};
        const adjusted: Record<string, UnreadEntry> = {};
        for (const [pid, entry] of Object.entries(raw)) {
          const e = entry as UnreadEntry;
          const d = dismissed[pid] ?? { total: 0, threads: 0, files: 0, events: 0 };
          const threads = Math.max(0, e.threads - d.threads);
          const files = Math.max(0, e.files - d.files);
          const events = Math.max(0, e.events - d.events);
          const total = threads + files + events;
          if (total > 0) adjusted[pid] = { total, threads, files, events };
        }
        set({ unreadByProject: adjusted });
      }
    } catch (e) { console.error("fetchUnreadCounts failed:", e); }
  },

  recordProjectView: (projectId: string) => {
    // Dismiss everything for this project
    const current = get().unreadByProject[projectId];
    if (current) {
      const dismissed = loadDismissed();
      const d = dismissed[projectId] ?? { total: 0, threads: 0, files: 0, events: 0 };
      dismissed[projectId] = {
        threads: d.threads + current.threads,
        files: d.files + current.files,
        events: d.events + current.events,
        total: d.total + current.total,
      };
      saveDismissed(dismissed);
    }
    set((state) => {
      const updated = { ...state.unreadByProject };
      delete updated[projectId];
      return { unreadByProject: updated };
    });
    fetch("/api/notifications/view", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId }) }).catch(() => {});
  },

  recordTabView: (projectId: string, tabKey: string) => {
    const key = tabKey === "discussion" ? "threads" : tabKey === "files" ? "files" : tabKey === "schedule" ? "events" : null;
    if (!key) return;
    // Accumulate dismissed count using the DISPLAYED count
    const current = get().unreadByProject[projectId];
    if (!current?.[key]) return;
    const dismissed = loadDismissed();
    const d = dismissed[projectId] ?? { total: 0, threads: 0, files: 0, events: 0 };
    d[key] += current[key];
    d.total = d.threads + d.files + d.events;
    dismissed[projectId] = d;
    saveDismissed(dismissed);
    // Optimistic clear
    set((state) => {
      const prev = state.unreadByProject[projectId];
      if (!prev) return state;
      const updated = { ...prev, [key]: 0 };
      updated.total = updated.threads + updated.files + updated.events;
      if (updated.total > 0) return { unreadByProject: { ...state.unreadByProject, [projectId]: updated } };
      const { [projectId]: _, ...rest } = state.unreadByProject;
      return { unreadByProject: rest };
    });
    fetch("/api/notifications/view", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId }) }).catch(() => {});
  },
}));
