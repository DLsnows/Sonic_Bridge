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

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  unreadByProject: Record<string, number>;
  dropdownOpen: boolean;
  setNotifications: (items: Notification[]) => void;
  setDropdownOpen: (open: boolean) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  fetchNotifications: () => Promise<void>;
  fetchUnreadCounts: () => Promise<void>;
  recordProjectView: (projectId: string) => Promise<void>;
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
    if (notif && notif.type !== "reply_to_user") {
      set((state) => {
        const updated = state.notifications.map((n) =>
          n.id === id ? { ...n, isRead: true } : n,
        );
        return { notifications: updated, unreadCount: updated.filter((n) => !n.isRead).length };
      });
      return;
    }

    const res = await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationId: id }),
    });
    if (!res.ok) return;
    set((state) => {
      const updated = state.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true } : n,
      );
      return { notifications: updated, unreadCount: updated.filter((n) => !n.isRead).length };
    });
  },

  markAllRead: async () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
      unreadCount: 0,
      unreadByProject: {},
    }));
    try {
      await fetch("/api/notifications", { method: "PATCH" });
    } catch (e) { console.error("markAllRead PATCH failed:", e); }
  },

  fetchNotifications: async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        get().setNotifications(data.notifications);
      }
    } catch { /* network ok to fail silently */ }
  },

  fetchUnreadCounts: async () => {
    try {
      const res = await fetch("/api/notifications/unread-counts");
      if (res.ok) {
        const data = await res.json();
        set({ unreadByProject: data.counts ?? {} });
      }
    } catch { /* best-effort */ }
  },

  recordProjectView: async (projectId: string) => {
    // Clear local unread count for this project immediately
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
    } catch { /* best-effort */ }
  },
}));
