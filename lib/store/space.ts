import { create } from "zustand";

export interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  text: string;
  timestamp: number;
}

interface SpaceState {
  isConnected: boolean;
  roomName: string | null;
  micEnabled: boolean;
  cameraEnabled: boolean;
  screenShareEnabled: boolean;
  chatMessages: ChatMessage[];
  unreadCount: number;
  setConnected: (connected: boolean) => void;
  setRoomName: (name: string) => void;
  toggleMic: () => void;
  toggleCamera: () => void;
  toggleScreenShare: () => void;
  addChatMessage: (msg: ChatMessage) => void;
  clearUnread: () => void;
}

export const useSpaceStore = create<SpaceState>((set) => ({
  isConnected: false,
  roomName: null,
  micEnabled: true,
  cameraEnabled: true,
  screenShareEnabled: false,
  chatMessages: [],
  unreadCount: 0,
  setConnected: (connected) => set({ isConnected: connected }),
  setRoomName: (name) => set({ roomName: name }),
  toggleMic: () => set((s) => ({ micEnabled: !s.micEnabled })),
  toggleCamera: () => set((s) => ({ cameraEnabled: !s.cameraEnabled })),
  toggleScreenShare: () =>
    set((s) => ({ screenShareEnabled: !s.screenShareEnabled })),
  addChatMessage: (msg) =>
    set((s) => ({
      chatMessages: [...s.chatMessages, msg],
      unreadCount: s.unreadCount + 1,
    })),
  clearUnread: () => set({ unreadCount: 0 }),
}));
