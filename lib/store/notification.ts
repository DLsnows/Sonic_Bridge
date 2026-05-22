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
  dropdownOpen: boolean;
  setNotifications: (items: Notification[]) => void;
  setDropdownOpen: (open: boolean) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  fetchNotifications: () => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  dropdownOpen: false,

  setNotifications: (items) =>
    set({ notifications: items, unreadCount: items.filter((n) => !n.isRead).length }),

  setDropdownOpen: (open) => set({ dropdownOpen: open }),

  markRead: async (id) => {
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
    const res = await fetch("/api/notifications", { method: "PATCH" });
    if (!res.ok) return;
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
      unreadCount: 0,
    }));
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
}));
