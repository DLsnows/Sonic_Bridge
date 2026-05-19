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

const iconColors: Record<string, string> = {
  SPEAKER: "text-[#00FF41]",
  IMG: "text-[#00FF41]",
  VID: "text-[#BD00FF]",
  TXT: "text-[#FFB800]",
  FILE: "text-[#A0A0B0]",
};

export function FileList({ files, loading, projectId, onDelete, onDownload }: FileListProps) {
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [playingFileId, setPlayingFileId] = useState<string | null>(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playingFileIdRef = useRef<string | null>(null);
  const audioListenersRef = useRef<Record<string, () => void> | null>(null);
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePlayAudio = useCallback(
    (fileId: string, _fileName: string) => {
      if (playingFileIdRef.current === fileId) {
        audioRef.current?.pause();
        playingFileIdRef.current = null;
        setPlayingFileId(null);
        return;
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        const prev = audioListenersRef.current;
        if (prev) {
          audioRef.current.removeEventListener("ended", prev.onEnded);
          audioRef.current.removeEventListener("pause", prev.onPause);
          audioRef.current.removeEventListener("error", prev.onError);
          audioRef.current.removeEventListener("canplay", prev.onCanPlay);
          audioListenersRef.current = null;
        }
      }
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
        errorTimeoutRef.current = null;
      }
      setAudioError(null);
      setAudioLoading(true);
      const audio = new Audio(`/api/projects/${projectId}/files/${fileId}?inline=1`);
      audio.preload = "auto";
      const onEnded = () => { playingFileIdRef.current = null; setPlayingFileId(null); };
      const onPause = () => {
        if (playingFileIdRef.current === fileId) {
          playingFileIdRef.current = null;
          setPlayingFileId(null);
        }
      };
      const onError = () => {
        const msg = audio.error?.message ?? "Audio playback failed";
        console.error("Audio error:", msg);
        setAudioError(msg);
        setAudioLoading(false);
        playingFileIdRef.current = null;
        setPlayingFileId(null);
        errorTimeoutRef.current = setTimeout(() => { setAudioError(null); errorTimeoutRef.current = null; }, 5000);
      };
      const onCanPlay = () => { setAudioLoading(false); };
      audio.addEventListener("ended", onEnded);
      audio.addEventListener("pause", onPause);
      audio.addEventListener("error", onError);
      audio.addEventListener("canplay", onCanPlay);
      audioListenersRef.current = { onEnded, onPause, onError, onCanPlay };
      audio.play().catch((err) => {
        console.error("Audio play() rejected:", err);
        setAudioLoading(false);
      });
      audioRef.current = audio;
      playingFileIdRef.current = fileId;
      setPlayingFileId(fileId);
    },
    [projectId],
  );

  // Clean up audio element on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        const prev = audioListenersRef.current;
        if (prev) {
          audioRef.current.removeEventListener("ended", prev.onEnded);
          audioRef.current.removeEventListener("pause", prev.onPause);
          audioRef.current.removeEventListener("error", prev.onError);
          audioRef.current.removeEventListener("canplay", prev.onCanPlay);
        }
        audioRef.current.src = "";
        audioRef.current = null;
      }
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
        errorTimeoutRef.current = null;
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
        <div className="text-4xl mb-3">◫</div>
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
                    <span className="text-[#F0F0F0] truncate max-w-[200px]">{file.name}</span>
                  </div>
                </td>
                <td className="py-2.5 px-3 text-[#A0A0B0] font-mono text-xs">{formatSize(file.size)}</td>
                <td className="py-2.5 px-3 text-[#A0A0B0] text-xs">{file.mimeType}</td>
                <td className="py-2.5 px-3 text-[#A0A0B0] text-xs">{file.uploaderName}</td>
                <td className="py-2.5 px-3 text-[#A0A0B0] text-xs">{new Date(file.uploadedAt).toLocaleDateString()}</td>
                <td className="py-2.5 px-3">
                  <div className="flex items-center justify-end gap-1">
                    {file.mimeType.startsWith("audio/") && (
                      <Button
                        variant={playingFileId === file.id ? "primary" : "ghost"}
                        size="sm"
                        onClick={() => handlePlayAudio(file.id, file.name)}
                      >
                        {playingFileId === file.id && audioLoading ? "⟳" : playingFileId === file.id ? "⏸" : "▶"}
                      </Button>
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
          Delete <span className="text-[#FF4444] font-medium">"{deleteTarget?.name}"</span>?
          This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}