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
    try {
      const res = await fetch("/api/notifications/unread-counts");
      if (res.ok) {
        const data = await res.json();
        set({ unreadByProject: data.counts ?? {} });
      }
    } catch (e) { console.error("fetchUnreadCounts failed:", e); }
  },

  recordProjectView: (projectId: string) => {
    set((state) => {
      const updated = { ...state.unreadByProject };
      delete updated[projectId];
      return { unreadByProject: updated };
    });
    fetch("/api/notifications/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId }),
    }).catch(() => {});
  },
}));
