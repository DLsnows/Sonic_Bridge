"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import { useSpaceStore } from "@/lib/store/space";
import { LiveKitTheme } from "./LiveKitTheme";
import { SpotlightView } from "./SpotlightView";
import { ControlBar } from "./ControlBar";
import { ChatPanel } from "./ChatPanel";
import { VstConnectionPanel } from "./VstConnectionPanel";
import { VstAudioBridge } from "./VstAudioBridge";
import { MicVolumeBridge } from "./MicVolumeBridge";
import { AudioMixer } from "./AudioMixer";
import { ParticipantList } from "./ParticipantList";
import { MediaSettingsPanel } from "./MediaSettingsPanel";
import { DevDebugPanel } from "./DevDebugPanel";

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
  const toggleMixer = useSpaceStore((s) => s.toggleMixer);
  const mixerOpen = useSpaceStore((s) => s.mixerOpen);
  const toggleMediaSettings = useSpaceStore((s) => s.toggleMediaSettings);
  const mediaSettingsOpen = useSpaceStore((s) => s.mediaSettingsOpen);
  const setMediaSettingsOpen = useSpaceStore((s) => s.setMediaSettingsOpen);
  const abortRef = useRef<AbortController | null>(null);
  const [dawPanelCollapsed, setDawPanelCollapsed] = useState(false);

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
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/projects/${projectId}/space/token`, {
          method: "POST",
          signal: controller.signal,
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
    })();
    return () => controller.abort();
  }, [projectId, setRoomName]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full border-2 border-[#00F0FF]/30 border-t-[#00F0FF] animate-spin" />
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
            className="px-6 py-2 bg-[#00F0FF]/20 text-[#00F0FF] rounded-lg text-sm hover:bg-[#00F0FF]/30 transition-colors border border-[#00F0FF]/20"
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
        onConnected={() => {
          setConnected(true);
          useSpaceStore.getState().setVideoWatchEnabled(true);
        }}
        onDisconnected={() => setConnected(false)}
        className="flex-1 flex min-w-0"
      >
        {/* VST bridge — invisible, manages connection + track publishing */}
        <VstAudioBridge
          projectId={projectId}
          userId={userId}
          username={username}
        />

        {/* Mic volume bridge — invisible, syncs mic gain to processor */}
        <MicVolumeBridge />

        {/* Left sidebar: VST panel — collapsible */}
        <aside className={`flex-shrink-0 border-r border-[#00F0FF]/10 bg-[#09090B]/60 backdrop-blur-sm transition-all duration-200 ${dawPanelCollapsed ? "w-9" : "w-72"}`}>
          {dawPanelCollapsed ? (
            <div
              className="h-full flex flex-col items-center py-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
              onClick={() => setDawPanelCollapsed(false)}
              title="Expand DAW Bridge"
            >
              <span className="text-sm">◈</span>
              <span className="text-[8px] text-[#00F0FF] font-['Share_Tech_Mono',monospace] uppercase tracking-wider mt-1" style={{ writingMode: "vertical-rl" }}>
                DAW
              </span>
              <span className="text-[9px] text-[#A0A0B0] mt-auto mb-2">▶</span>
            </div>
          ) : (
            <div className="h-full overflow-y-auto relative">
              <button
                onClick={() => setDawPanelCollapsed(true)}
                className="absolute top-2 right-2 z-10 text-[10px] text-[#A0A0B0] hover:text-[#F0F0F0] transition-colors"
                title="Collapse"
              >
                ◀
              </button>
              <VstConnectionPanel />
            </div>
          )}
        </aside>

        {/* Main area: video grid + audio renderer */}
        <div className="flex-1 flex flex-col min-w-0">
          <SpotlightView />
          <RoomAudioRenderer />
        </div>

        {/* Right sidebar: participant list + chat */}
        <aside className="w-72 flex-shrink-0 border-l border-[#00F0FF]/10 bg-[#09090B]/60 backdrop-blur-sm flex flex-col">
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            <ParticipantList userId={userId} />
          </div>
          <div className="p-3 border-t border-[#00F0FF]/10 flex justify-center">
            <ChatPanel userId={userId} />
          </div>
        </aside>

        {/* Floating control bar — fixed overlay */}
        <ControlBar
          projectId={projectId}
          onToggleMixer={toggleMixer}
          mixerOpen={mixerOpen}
          onToggleMediaSettings={toggleMediaSettings}
          mediaSettingsOpen={mediaSettingsOpen}
        />

        {/* Audio mixer — fixed overlay inside room context */}
        <AudioMixer />

        {/* Media quality settings modal */}
        <MediaSettingsPanel
          open={mediaSettingsOpen}
          onClose={() => setMediaSettingsOpen(false)}
        />

        {/* Dev-only diagnostic panel (NODE_ENV gate inside the component) */}
        <DevDebugPanel />
      </LiveKitRoom>
    </div>
  );
}
