"use client";

import { useState, useCallback } from "react";
import { useLocalParticipant, useMaybeRoomContext } from "@livekit/components-react";
import { useRouter } from "next/navigation";
import { useSpaceStore } from "@/lib/store/space";
import { useMediaSettingsStore } from "@/lib/store/media-settings";
import { getMicProcessor } from "@/lib/mic-processor";
import { DeviceSelector } from "./DeviceSelector";

export function ControlBar({
  projectId,
  onToggleMixer,
  mixerOpen,
  onToggleMediaSettings,
  mediaSettingsOpen,
}: {
  projectId: string;
  onToggleMixer: () => void;
  mixerOpen: boolean;
  onToggleMediaSettings: () => void;
  mediaSettingsOpen: boolean;
}) {
  const router = useRouter();
  const room = useMaybeRoomContext();
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } =
    useLocalParticipant();
  const isConnected = useSpaceStore((s) => s.isConnected);
  const videoWatchEnabled = useSpaceStore((s) => s.videoWatchEnabled);
  const toggleVideoWatch = useSpaceStore((s) => s.toggleVideoWatch);

  const [showMicSelector, setShowMicSelector] = useState(false);
  const [showCameraSelector, setShowCameraSelector] = useState(false);
  const [micDeviceId, setMicDeviceId] = useState<string | null>(null);
  const [cameraDeviceId, setCameraDeviceId] = useState<string | null>(null);

  async function handleToggleMic() {
    try {
      if (!isMicrophoneEnabled) {
        await localParticipant.setMicrophoneEnabled(
          true,
          getMicProcessor().getCaptureOptions(),
        );
      } else {
        await localParticipant.setMicrophoneEnabled(false);
      }
    } catch { /* device access may be denied */ }
  }

  async function handleToggleCamera() {
    try {
      await localParticipant.setCameraEnabled(!isCameraEnabled);
    } catch { /* device access may be denied */ }
  }

  async function handleToggleScreenShare() {
    try {
      if (isScreenShareEnabled) {
        await localParticipant.setScreenShareEnabled(false);
        return;
      }
      const ss = useMediaSettingsStore.getState().screenShare;
      const options: { resolution?: { width: number; height: number; frameRate: number }; audio: boolean; selfBrowserSurface: "exclude" } = {
        audio: false,
        selfBrowserSurface: "exclude",
      };
      if (ss.resolution !== "original") {
        options.resolution = {
          width: ss.resolution === "720p" ? 1280 : 1920,
          height: ss.resolution === "720p" ? 720 : 1080,
          frameRate: ss.frameRate,
        };
      } else {
        options.resolution = { width: 0, height: 0, frameRate: ss.frameRate };
      }
      await localParticipant.setScreenShareEnabled(true, options);
    } catch { /* screen share may not be available */ }
  }

  const handleSelectMicDevice = useCallback(
    async (deviceId: string) => {
      try {
        if (room) {
          await room.switchActiveDevice("audioinput", deviceId);
          setMicDeviceId(deviceId);
        }
      } catch { /* device switch failed */ }
      setShowMicSelector(false);
    },
    [room],
  );

  const handleSelectCameraDevice = useCallback(
    async (deviceId: string) => {
      try {
        if (room) {
          await room.switchActiveDevice("videoinput", deviceId);
          setCameraDeviceId(deviceId);
        }
      } catch { /* device switch failed */ }
      setShowCameraSelector(false);
    },
    [room],
  );

  function handleLeave() {
    router.push(`/projects/${projectId}`);
  }

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
      <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#0A0A0F]/90 backdrop-blur-xl border border-[#00F0FF]/15 shadow-[0_0_30px_rgba(0,240,255,0.08)]">
        {/* Mic button + device selector */}
        <div className="relative">
          <div className="flex items-center gap-0.5">
            <button
              onClick={handleToggleMic}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 ${
                isMicrophoneEnabled
                  ? "bg-[#00F0FF]/15 text-[#00F0FF] hover:bg-[#00F0FF]/25"
                  : "bg-[#FF4444]/15 text-[#FF4444] hover:bg-[#FF4444]/25"
              }`}
              title={isMicrophoneEnabled ? "Mute microphone" : "Unmute microphone"}
            >
              {isMicrophoneEnabled ? "🎤" : "🔇"}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setShowMicSelector(!showMicSelector); setShowCameraSelector(false); }}
              className="w-4 h-9 rounded-r-full flex items-center justify-center text-[10px] text-[#A0A0B0] hover:text-[#00F0FF] transition-colors"
              title="Select microphone"
            >
              ▼
            </button>
          </div>
          {showMicSelector && (
            <DeviceSelector
              kind="audioinput"
              currentDeviceId={micDeviceId}
              onSelect={handleSelectMicDevice}
              onClose={() => setShowMicSelector(false)}
            />
          )}
        </div>

        {/* Camera button + device selector */}
        <div className="relative">
          <div className="flex items-center gap-0.5">
            <button
              onClick={handleToggleCamera}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 ${
                isCameraEnabled
                  ? "bg-[#00F0FF]/15 text-[#00F0FF] hover:bg-[#00F0FF]/25"
                  : "bg-[#FF4444]/15 text-[#FF4444] hover:bg-[#FF4444]/25"
              }`}
              title={isCameraEnabled ? "Turn off camera" : "Turn on camera"}
            >
              {isCameraEnabled ? "📹" : "📷"}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setShowCameraSelector(!showCameraSelector); setShowMicSelector(false); }}
              className="w-4 h-9 rounded-r-full flex items-center justify-center text-[10px] text-[#A0A0B0] hover:text-[#00F0FF] transition-colors"
              title="Select camera"
            >
              ▼
            </button>
          </div>
          {showCameraSelector && (
            <DeviceSelector
              kind="videoinput"
              currentDeviceId={cameraDeviceId}
              onSelect={handleSelectCameraDevice}
              onClose={() => setShowCameraSelector(false)}
            />
          )}
        </div>

        {/* Screen share */}
        <button
          onClick={handleToggleScreenShare}
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 ${
            isScreenShareEnabled
              ? "bg-[#00F0FF]/15 text-[#00F0FF] hover:bg-[#00F0FF]/25"
              : "bg-white/5 text-[#A0A0B0] hover:bg-white/10 hover:text-[#F0F0F0]"
          }`}
          title={isScreenShareEnabled ? "Stop sharing screen" : "Share screen"}
        >
          🖥
        </button>

        {/* Stop/Resume watching video */}
        <button
          onClick={toggleVideoWatch}
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 ${
            videoWatchEnabled
              ? "bg-white/5 text-[#A0A0B0] hover:bg-white/10 hover:text-[#F0F0F0]"
              : "bg-[#FFB800]/15 text-[#FFB800] hover:bg-[#FFB800]/25"
          }`}
          title={videoWatchEnabled ? "Pause video to save bandwidth" : "Resume watching"}
        >
          {videoWatchEnabled ? "👁" : "👁‍🗨"}
        </button>

        {/* Audio mixer toggle */}
        <button
          onClick={onToggleMixer}
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 ${
            mixerOpen
              ? "bg-[#00F0FF]/15 text-[#00F0FF]"
              : "bg-white/5 text-[#A0A0B0] hover:bg-white/10 hover:text-[#F0F0F0]"
          }`}
          title={mixerOpen ? "Close audio mixer" : "Open audio mixer"}
        >
          🎚
        </button>

        {/* Media settings */}
        <button
          onClick={onToggleMediaSettings}
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 ${
            mediaSettingsOpen
              ? "bg-[#00F0FF]/15 text-[#00F0FF]"
              : "bg-white/5 text-[#A0A0B0] hover:bg-white/10 hover:text-[#F0F0F0]"
          }`}
          title="Media quality settings"
        >
          ⚙
        </button>

        {/* Separator */}
        <div className="w-px h-5 bg-[#00F0FF]/10 mx-1" />

        {/* Connection status */}
        <div className="flex items-center gap-1.5 px-2 text-xs text-[#A0A0B0]">
          <span
            className={`w-2 h-2 rounded-full ${
              isConnected ? "bg-[#00F0FF] animate-glow-pulse" : "bg-[#FF4444]"
            }`}
          />
          <span className="text-[10px] font-['Share_Tech_Mono',monospace] hidden sm:inline">
            {isConnected ? "Live" : "Off"}
          </span>
        </div>

        {/* Leave button */}
        <button
          onClick={handleLeave}
          className="px-3 py-1.5 rounded-full text-[#FF4444] text-xs hover:bg-[#FF4444]/10 transition-colors font-['Share_Tech_Mono',monospace]"
        >
          Leave
        </button>
      </div>
    </div>
  );
}
