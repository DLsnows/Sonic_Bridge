"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { FileItem } from "./types";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

interface FileListProps {
  files: FileItem[];
  loading: boolean;
  projectId: string;
  onDelete: (fileId: string) => void;
  onDownload: (fileId: string, fileName: string) => void;
  onOpenPlayer?: (file: FileItem) => void;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}

function fileIcon(mimeType: string): string {
  if (mimeType.startsWith("audio/")) return "SPEAKER";
  if (mimeType.startsWith("image/")) return "IMG";
  if (mimeType.startsWith("video/")) return "VID";
  if (mimeType.startsWith("text/")) return "TXT";
  return "FILE";
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const iconColors: Record<string, string> = {
  SPEAKER: "text-[#00FF41]",
  IMG: "text-[#00FF41]",
  VID: "text-[#BD00FF]",
  TXT: "text-[#FFB800]",
  FILE: "text-[#A0A0B0]",
};

export function FileList({ files, loading, projectId, onDelete, onDownload, onOpenPlayer }: FileListProps) {
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [playingFileId, setPlayingFileId] = useState<string | null>(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playingFileIdRef = useRef<string | null>(null);
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioListenersRef = useRef<Record<string, () => void> | null>(null);
  const animationRef = useRef<number | null>(null);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioVolume, setAudioVolume] = useState(1);

  const handlePlayAudio = useCallback(
    (fileId: string, fileUrl: string, mimeType?: string) => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }

      setAudioCurrentTime(0);
      setAudioDuration(0);

      if (playingFileIdRef.current === fileId) {
        audioRef.current?.pause();
        audioRef.current = null;
        playingFileIdRef.current = null;
        setPlayingFileId(null);
        setAudioLoading(false);
        return;
      }

      if (mimeType) {
        const testAudio = document.createElement("audio");
        if (testAudio.canPlayType(mimeType) === "") {
          setAudioError(`Browser does not support ${mimeType} playback`);
          if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
          errorTimeoutRef.current = setTimeout(() => setAudioError(null), 5000);
          return;
        }
      }

      // Clean up previous audio element and listeners
      if (audioRef.current) {
        const prevListeners = audioListenersRef.current;
        if (prevListeners) {
          audioRef.current.removeEventListener("ended", prevListeners.ended);
          audioRef.current.removeEventListener("pause", prevListeners.pause);
          audioRef.current.removeEventListener("error", prevListeners.error);
          audioRef.current.removeEventListener("canplay", prevListeners.canplay);
          audioListenersRef.current = null;
        }
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }

      setAudioError(null);
      setAudioLoading(true);

      const audio = new Audio(fileUrl);
      audio.preload = "auto";

      const onEnded = () => {
        playingFileIdRef.current = null;
        setPlayingFileId(null);
        setAudioLoading(false);
      };
      const onPause = () => {
        if (playingFileIdRef.current === fileId) {
          playingFileIdRef.current = null;
          setPlayingFileId(null);
          setAudioLoading(false);
        }
      };
      const onError = () => {
        console.error("Audio playback error:", audio.error);
        setAudioError("Playback failed. The file may be unavailable.");
        playingFileIdRef.current = null;
        setPlayingFileId(null);
        setAudioLoading(false);
        if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
        errorTimeoutRef.current = setTimeout(() => setAudioError(null), 5000);
      };
      const onCanPlay = () => {
        setAudioLoading(false);
        setAudioDuration(audio.duration || 0);
        const updateTime = () => {
          setAudioCurrentTime(audio.currentTime);
          animationRef.current = requestAnimationFrame(updateTime);
        };
        animationRef.current = requestAnimationFrame(updateTime);
      };

      audio.addEventListener("ended", onEnded);
      audio.addEventListener("pause", onPause);
      audio.addEventListener("error", onError);
      audio.addEventListener("canplay", onCanPlay);
      audioListenersRef.current = { ended: onEnded, pause: onPause, error: onError, canplay: onCanPlay };

      audio.play().catch((err) => {
        console.error("Audio play() rejected:", err);
        setAudioError("Playback failed. The file may be unavailable.");
        setAudioLoading(false);
        playingFileIdRef.current = null;
        setPlayingFileId(null);
        if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
        errorTimeoutRef.current = setTimeout(() => setAudioError(null), 5000);
      });

      audioRef.current = audio;
      playingFileIdRef.current = fileId;
      setPlayingFileId(fileId);
    },
    [],
  );

  const handleSeek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setAudioCurrentTime(time);
    }
  };

  const handleVolumeChange = (vol: number) => {
    setAudioVolume(vol);
    if (audioRef.current) audioRef.current.volume = vol;
  };

  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (audioRef.current) {
        const listeners = audioListenersRef.current;
        if (listeners) {
          audioRef.current.removeEventListener("ended", listeners.ended);
          audioRef.current.removeEventListener("pause", listeners.pause);
          audioRef.current.removeEventListener("error", listeners.error);
          audioRef.current.removeEventListener("canplay", listeners.canplay);
          audioListenersRef.current = null;
        }
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 bg-white/5 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-4xl mb-3">?</div>
        <p className="text-[#A0A0B0] text-sm">
          No files in this folder. Upload files to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      {audioError && (
        <div className="mb-3 px-4 py-2 bg-[#FF4444]/10 border border-[#FF4444]/30 rounded text-xs text-[#FF4444]">
          {audioError}
        </div>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10">
            <th className="text-left py-2 px-3 text-[#A0A0B0] font-['Share_Tech_Mono',monospace] text-[10px] uppercase tracking-wider">Name</th>
            <th className="text-left py-2 px-3 text-[#A0A0B0] font-['Share_Tech_Mono',monospace] text-[10px] uppercase tracking-wider">Size</th>
            <th className="text-left py-2 px-3 text-[#A0A0B0] font-['Share_Tech_Mono',monospace] text-[10px] uppercase tracking-wider">Type</th>
            <th className="text-left py-2 px-3 text-[#A0A0B0] font-['Share_Tech_Mono',monospace] text-[10px] uppercase tracking-wider">Uploaded By</th>
            <th className="text-left py-2 px-3 text-[#A0A0B0] font-['Share_Tech_Mono',monospace] text-[10px] uppercase tracking-wider">Date</th>
            <th className="text-right py-2 px-3 text-[#A0A0B0] font-['Share_Tech_Mono',monospace] text-[10px] uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody>
          {files.map((file) => {
            const icon = fileIcon(file.mimeType);
            const colorClass = iconColors[icon] ?? "text-[#A0A0B0]";
            return (
              <tr key={file.id} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                <td className="py-2.5 px-3">
                  <div className="flex items-center gap-2">
                    <span className={`font-['Share_Tech_Mono',monospace] text-[10px] ${colorClass}`}>{icon}</span>
                    <span
                      className={`text-[#F0F0F0] truncate max-w-[200px] ${file.mimeType.startsWith("audio/") ? "cursor-pointer hover:text-[#00F0FF] hover:underline transition-colors" : ""}`}
                      onClick={() => {
                        if (file.mimeType.startsWith("audio/") && onOpenPlayer) {
                          onOpenPlayer(file);
                        }
                      }}
                    >
                      {file.name}
                    </span>
                  </div>
                </td>
                <td className="py-2.5 px-3 text-[#A0A0B0] font-mono text-xs">{formatSize(file.size)}</td>
                <td className="py-2.5 px-3 text-[#A0A0B0] text-xs">{file.mimeType}</td>
                <td className="py-2.5 px-3 text-[#A0A0B0] text-xs">{file.uploaderName}</td>
                <td className="py-2.5 px-3 text-[#A0A0B0] text-xs">{new Date(file.uploadedAt).toLocaleDateString()}</td>
                <td className="py-2.5 px-3">
                  <div className="flex items-center justify-end gap-1">
                    {file.mimeType.startsWith("audio/") && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant={playingFileId === file.id ? "primary" : "ghost"}
                          size="sm"
                          onClick={() => handlePlayAudio(file.id, `/api/projects/${projectId}/files/${file.id}?inline=1`, file.mimeType)}
                        >
                          {playingFileId === file.id && audioLoading ? "..." : playingFileId === file.id ? "⏸" : "▶"}
                        </Button>
                        {playingFileId === file.id && !audioLoading && (
                          <div className="flex items-center gap-1.5 bg-[#0F0F13] border border-white/5 rounded px-2 py-1">
                            <span className="text-[10px] text-[#F0F0F0] font-mono tabular-nums min-w-[28px]">
                              {formatTime(audioCurrentTime)}
                            </span>
                            <input
                              type="range"
                              min={0}
                              max={audioDuration || 0}
                              step={0.1}
                              value={audioCurrentTime}
                              onChange={(e) => handleSeek(parseFloat(e.target.value))}
                              className="w-20 h-1 appearance-none bg-white/10 rounded-full outline-none cursor-pointer
                                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5
                                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#00F0FF]"
                            />
                            <span className="text-[10px] text-[#A0A0B0] font-mono tabular-nums min-w-[28px]">
                              {formatTime(audioDuration)}
                            </span>
                            <button
                              onClick={() => handleVolumeChange(audioVolume === 0 ? 1 : 0)}
                              className="text-[10px] text-[#A0A0B0] hover:text-[#F0F0F0]"
                            >
                              {audioVolume === 0 ? "🔇" : audioVolume < 0.5 ? "🔉" : "🔊"}
                            </button>
                            <input
                              type="range"
                              min={0}
                              max={1}
                              step={0.05}
                              value={audioVolume}
                              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                              className="w-12 h-1 appearance-none bg-white/10 rounded-full outline-none cursor-pointer
                                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5
                                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#00F0FF]"
                            />
                          </div>
                        )}
                      </div>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => onDownload(file.id, file.name)}>DL</Button>
                    <Button variant="danger" size="sm" onClick={() => setDeleteTarget({ id: file.id, name: file.name })}>DEL</Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete File"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                if (deleteTarget) onDelete(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-[#D0D0D0]">
          Delete <span className="text-[#FF4444] font-medium">&quot;{deleteTarget?.name}&quot;</span>?
          This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
