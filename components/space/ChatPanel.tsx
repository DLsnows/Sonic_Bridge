"use client";

import { useState, useRef, useEffect } from "react";
import { useChat } from "@livekit/components-react";
import { useSpaceStore } from "@/lib/store/space";

interface ChatPanelProps {
  userId: string;
}

export function ChatPanel({ userId }: ChatPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const { chatMessages, send, isSending } = useChat();
  const unreadCount = useSpaceStore((s) => s.unreadCount);
  const incrementUnread = useSpaceStore((s) => s.incrementUnread);
  const clearUnread = useSpaceStore((s) => s.clearUnread);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  useEffect(() => {
    if (!isOpen && chatMessages.length > prevCountRef.current) {
      incrementUnread();
    }
    if (isOpen) {
      prevCountRef.current = chatMessages.length;
    }
  }, [chatMessages.length, isOpen, incrementUnread]);

  function handleToggle() {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);
    if (nextOpen) {
      clearUnread();
      prevCountRef.current = chatMessages.length;
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isSending) return;

    try {
      await send(text);
      setInput("");
    } catch {
      // send failed; LiveKit handles error state
    }
  }

  return (
    <>
      <button
        onClick={handleToggle}
        className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 ${
          isOpen
            ? "bg-[#00FF41]/20 text-[#00FF41]"
            : "bg-[#0F0F13] text-[#A0A0B0]"
        } relative`}
        title={isOpen ? "Close chat" : "Open chat"}
      >
        💬
        {!isOpen && unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#00FF41] text-[#09090B] text-xs rounded-full flex items-center justify-center font-bold">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-0 h-full w-80 border-l border-[#00FF41]/10 bg-[#09090B]/95 backdrop-blur-lg flex flex-col z-30 animate-fade-in">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#00FF41]/10">
            <h3 className="font-['Share_Tech_Mono',monospace] text-[#F0F0F0] text-sm">
              Chat
            </h3>
            <button
              onClick={handleToggle}
              className="text-[#A0A0B0] hover:text-[#F0F0F0] text-lg"
            >
              ✕
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {chatMessages.length === 0 && (
              <p className="text-[#A0A0B0] text-xs text-center py-8">
                No messages yet. Start the conversation!
              </p>
            )}
            {chatMessages.map((msg) => {
              const isOwn = msg.from?.identity === userId;
              return (
                <div
                  key={`${msg.from?.identity ?? 'unknown'}-${msg.timestamp}`}
                  className={`${isOwn ? "items-end" : "items-start"} flex flex-col`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] text-[#A0A0B0]">
                      {msg.from?.name ?? msg.from?.identity ?? "Unknown"}
                    </span>
                    <span className="text-[10px] text-[#A0A0B0]/50">
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div
                    className={`px-3 py-2 rounded-lg text-sm max-w-full break-words ${
                      isOwn
                        ? "bg-[#00FF41]/10 border border-[#00FF41]/20 text-[#F0F0F0]"
                        : "bg-[#0F0F13] border border-[#00FF41]/10 text-[#F0F0F0]"
                    }`}
                  >
                    {msg.message}
                  </div>
                </div>
              );
            })}
          </div>

          <form onSubmit={handleSend} className="p-3 border-t border-[#00FF41]/10 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-[#0F0F13] border border-[#00FF41]/10 rounded-lg px-3 py-2 text-sm text-[#F0F0F0] placeholder-[#A0A0B0] focus:outline-none focus:border-[#00FF41]/40 transition-colors"
            />
            <button
              type="submit"
              disabled={!input.trim() || isSending}
              className="px-3 py-2 bg-[#00FF41]/20 text-[#00FF41] rounded-lg text-sm disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#00FF41]/30 transition-colors"
            >
              {isSending ? "..." : "Send"}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
