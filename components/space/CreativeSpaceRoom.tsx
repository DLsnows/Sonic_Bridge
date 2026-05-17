"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import { useSpaceStore } from "@/lib/store/space";
import { LiveKitTheme } from "./LiveKitTheme";
import { ParticipantGrid } from "./ParticipantGrid";
import { ControlBar } from "./ControlBar";
import { ChatPanel } from "./ChatPanel";
import { VstConnectionPanel } from "./VstConnectionPanel";
import { VstAudioBridge } from "./VstAudioBridge";

interface CreativeSpaceRoomProps {
  projectId: string;
  userId: string;
  username: string;
}

interface TokenData {
  token: string;
  roomName: string;
  wsUrl: string;
}

export function CreativeSpaceRoom({
  projectId,
  userId,
  username,
}: CreativeSpaceRoomProps) {
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const setConnected = useSpaceStore((s) => s.setConnected);
  const setRoomName = useSpaceStore((s) => s.setRoomName);
  const abortRef = useRef<AbortController | null>(null);

  const fetchToken = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/projects/${projectId}/space/token`, {
          method: "POST",
          signal,
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Failed to get token");
        }
        const data: TokenData = await res.json();
        setTokenData(data);
        setRoomName(data.roomName);
      } catch (e: unknown) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError(
          e instanceof Error ? e.message : "Connection failed",
        );
      } finally {
        setLoading(false);
      }
    },
    [projectId, setRoomName],
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchToken(controller.signal);
    return () => controller.abort();
  }, [fetchToken]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full border-2 border-[#00FF41]/30 border-t-[#00FF41] animate-spin" />
          <p className="text-[#A0A0B0] text-sm">
            Connecting to Creative Space...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="glass-panel text-center py-12 px-8 max-w-md">
          <div className="text-4xl mb-4">⚠</div>
          <h3 className="font-['Share_Tech_Mono',monospace] text-[#FF4444] text-lg mb-2">
            Connection Failed
          </h3>
          <p className="text-[#A0A0B0] text-sm mb-6">{error}</p>
          <button
            onClick={() => {
              abortRef.current?.abort();
              const controller = new AbortController();
              abortRef.current = controller;
              fetchToken(controller.signal);
            }}
            className="px-6 py-2 bg-[#00FF41]/20 text-[#00FF41] rounded-lg text-sm hover:bg-[#00FF41]/30 transition-colors border border-[#00FF41]/20"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!tokenData) return null;

  return (
    <div className="flex h-[calc(100vh-4rem)] relative">
      <LiveKitTheme />
      <LiveKitRoom
        serverUrl={tokenData.wsUrl}
        token={tokenData.token}
        connect={true}
        audio={false}
        video={false}
        onConnected={() => setConnected(true)}
        onDisconnected={() => setConnected(false)}
        className="flex-1 flex min-w-0"
      >
        {/* VST bridge — invisible, manages connection + track publishing */}
        <VstAudioBridge
          projectId={projectId}
          userId={userId}
          username={username}
        />

        {/* Main area: video grid + controls */}
        <div className="flex-1 flex flex-col min-w-0">
          <ParticipantGrid />
          <RoomAudioRenderer />
          <div className="flex items-center px-4 py-2 border-t border-[#00FF41]/10">
            <ControlBar projectId={projectId} />
          </div>
        </div>

        {/* Right sidebar: VST panel + chat */}
        <aside className="w-72 flex flex-col border-l border-[#00FF41]/10 bg-[#09090B]/60 backdrop-blur-sm shrink-0">
          <div className="flex-1 overflow-y-auto">
            <VstConnectionPanel />
          </div>
          <div className="border-t border-[#00FF41]/10">
            <ChatPanel userId={userId} />
          </div>
        </aside>
      </LiveKitRoom>
    </div>
  );
}
