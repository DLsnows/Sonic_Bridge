import { create } from "zustand";

interface SpaceState {
  isConnected: boolean;
  roomName: string | null;
  unreadCount: number;
  chatOpen: boolean;
  setConnected: (connected: boolean) => void;
  setRoomName: (name: string) => void;
  incrementUnread: () => void;
  clearUnread: () => void;
  setChatOpen: (open: boolean) => void;
}

export const useSpaceStore = create<SpaceState>((set) => ({
  isConnected: false,
  roomName: null,
  unreadCount: 0,
  chatOpen: false,
  setConnected: (connected) => set({ isConnected: connected }),
  setRoomName: (name) => set({ roomName: name }),
  incrementUnread: () => set((s) => ({ unreadCount: s.unreadCount + 1 })),
  clearUnread: () => set({ unreadCount: 0 }),
  setChatOpen: (open) => set({ chatOpen: open }),
}));
