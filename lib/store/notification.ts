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
    // Find the notification to check if it's from the notifications table
    const notif = get().notifications.find((n) => n.id === id);
    // Source-table items (new_post, new_file, new_event) have no DB row —
    // just update local state. Only reply_to_user items need an API call.
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
    // Update local state immediately for all items
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
      unreadCount: 0,
    }));
    // Also sync DB-backed items (reply_to_user) via API
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
}));
