"use client";

import { useEffect, useState, useCallback } from "react";
import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import { useSpaceStore } from "@/lib/store/space";
import { LiveKitTheme } from "./LiveKitTheme";
import { ParticipantGrid } from "./ParticipantGrid";
import { ControlBar } from "./ControlBar";
import { ChatPanel } from "./ChatPanel";

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

  const fetchToken = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/space/token`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to get token");
      }
      const data: TokenData = await res.json();
      setTokenData(data);
      setRoomName(data.roomName);
    } catch (e: any) {
      setError(e.message ?? "Connection failed");
    } finally {
      setLoading(false);
    }
  }, [projectId, setRoomName]);

  useEffect(() => {
    fetchToken();
  }, [fetchToken]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full border-2 border-[#00FF41]/30 border-t-[#00FF41] animate-spin" />
          <p className="text-[#A0A0B0] text-sm">Connecting to Creative Space...</p>
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
            onClick={fetchToken}
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
    <div className="flex flex-col h-[calc(100vh-4rem)] relative">
      <LiveKitTheme />
      <LiveKitRoom
        serverUrl={tokenData.wsUrl}
        token={tokenData.token}
        connect={true}
        audio={true}
        video={true}
        onConnected={() => setConnected(true)}
        onDisconnected={() => setConnected(false)}
        className="flex-1 flex flex-col"
      >
        <ParticipantGrid />
        <RoomAudioRenderer />
        <div className="flex items-center justify-between px-4 py-2 border-t border-[#00FF41]/10">
          <ControlBar projectId={projectId} />
          <ChatPanel userId={userId} username={username} />
        </div>
      </LiveKitRoom>
    </div>
  );
}
