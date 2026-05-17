"use client";

import { useLocalParticipant } from "@livekit/components-react";
import { useRouter } from "next/navigation";
import { useSpaceStore } from "@/lib/store/space";

export function ControlBar({ projectId }: { projectId: string }) {
  const router = useRouter();
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } =
    useLocalParticipant();
  const micEnabled = useSpaceStore((s) => s.micEnabled);
  const cameraEnabled = useSpaceStore((s) => s.cameraEnabled);
  const toggleMic = useSpaceStore((s) => s.toggleMic);
  const toggleCamera = useSpaceStore((s) => s.toggleCamera);
  const toggleScreenShare = useSpaceStore((s) => s.toggleScreenShare);
  const isConnected = useSpaceStore((s) => s.isConnected);

  async function handleToggleMic() {
    try {
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
      toggleMic();
    } catch {
      // silently fail
    }
  }

  async function handleToggleCamera() {
    try {
      await localParticipant.setCameraEnabled(!isCameraEnabled);
      toggleCamera();
    } catch {
      // silently fail
    }
  }

  async function handleToggleScreenShare() {
    try {
      if (isScreenShareEnabled) {
        await localParticipant.setScreenShareEnabled(false);
      } else {
        await localParticipant.setScreenShareEnabled(true);
      }
      toggleScreenShare();
    } catch {
      // silently fail
    }
  }

  function handleLeave() {
    router.push(`/projects/${projectId}`);
  }

  return (
    <div className="flex items-center justify-center gap-3 p-4">
      <div className="glass-panel flex items-center gap-2 px-4 py-2">
        <button
          onClick={handleToggleMic}
          className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 ${
            micEnabled
              ? "bg-[#00FF41]/20 text-[#00FF41] shadow-[0_0_10px_rgba(0,255,65,0.2)]"
              : "bg-[#FF4444]/20 text-[#FF4444]"
          }`}
          title={micEnabled ? "Mute microphone" : "Unmute microphone"}
        >
          {micEnabled ? "🎤" : "🔇"}
        </button>

        <button
          onClick={handleToggleCamera}
          className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 ${
            cameraEnabled
              ? "bg-[#00FF41]/20 text-[#00FF41] shadow-[0_0_10px_rgba(0,255,65,0.2)]"
              : "bg-[#FF4444]/20 text-[#FF4444]"
          }`}
          title={cameraEnabled ? "Turn off camera" : "Turn on camera"}
        >
          {cameraEnabled ? "📹" : "📷"}
        </button>

        <button
          onClick={handleToggleScreenShare}
          className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 ${
            isScreenShareEnabled
              ? "bg-[#00F0FF]/20 text-[#00F0FF] shadow-[0_0_10px_rgba(0,240,255,0.2)]"
              : "bg-[#0F0F13] text-[#A0A0B0]"
          }`}
          title={isScreenShareEnabled ? "Stop sharing screen" : "Share screen"}
        >
          🖥
        </button>
      </div>

      <div className="glass-panel flex items-center gap-2 px-4 py-2">
        <div className="flex items-center gap-2 text-xs text-[#A0A0B0]">
          <span
            className={`w-2 h-2 rounded-full ${
              isConnected ? "bg-[#00FF41] animate-glow-pulse" : "bg-[#FF4444]"
            }`}
          />
          {isConnected ? "Connected" : "Disconnected"}
        </div>
      </div>

      <button
        onClick={handleLeave}
        className="glass-panel px-4 py-2 text-[#FF4444] text-sm hover:bg-[#FF4444]/10 transition-colors"
      >
        Leave Room
      </button>
    </div>
  );
}
