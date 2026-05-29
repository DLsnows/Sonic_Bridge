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
  onRename?: (fileId: string, newName: string) => void;
  onOpenPlayer?: (file: FileItem) => void;
  // Lifted-up drag state so FileBrowser can guarantee the opacity reset even
  // when the browser swallows `dragend` (e.g. the source row was removed
  // during the drop's re-render). Round 2 BUG 2.
  draggingFileId: string | null;
  setDraggingFileId: (id: string | null) => void;
}

function fileExtension(name: string): string {
  const idx = name.lastIndexOf(".");
  // idx <= 0: either no dot, or a leading-dot dotfile (e.g. ".gitignore").
  // Both → empty extension, matching the server's rule.
  return idx <= 0 ? "" : name.slice(idx + 1).toLowerCase();
}

// Split a filename into editable basename + immutable ".ext" suffix label.
// Mirrors the server's rule (idx <= 0 → no extension; dotfiles like
// ".gitignore" stay whole).
function splitName(name: string): { base: string; extWithDot: string } {
  const idx = name.lastIndexOf(".");
  if (idx <= 0) return { base: name, extWithDot: "" };
  return { base: name.slice(0, idx), extWithDot: name.slice(idx) };
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

export function FileList({ files, loading, projectId, onDelete, onDownload, onRename, onOpenPlayer, draggingFileId, setDraggingFileId }: FileListProps) {
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [renamingFileId, setRenamingFileId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState<string>("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const renameErrorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [playingFileId, setPlayingFileId] = useState<string | null>(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  const [renameExtSuffix, setRenameExtSuffix] = useState<string>("");
  const startRename = (file: FileItem) => {
    setRenamingFileId(file.id);
    // Editable input gets ONLY the basename; the `.ext` suffix renders as a
    // gray, non-editable label next to the input. The user cannot change the
    // extension by accident. Round 2 BUG 4.
    const { base, extWithDot } = splitName(file.name);
    setRenameDraft(base);
    setRenameExtSuffix(extWithDot);
    setRenameError(null);
  };
  const cancelRename = () => {
    setRenamingFileId(null);
    setRenameDraft("");
    setRenameExtSuffix("");
  };
  const showRenameError = (msg: string) => {
    setRenameError(msg);
    if (renameErrorTimeoutRef.current) clearTimeout(renameErrorTimeoutRef.current);
    renameErrorTimeoutRef.current = setTimeout(() => setRenameError(null), 4000);
  };
  const submitRename = (file: FileItem) => {
    const trimmedBase = renameDraft.trim();
    if (!trimmedBase) {
      cancelRename();
      return;
    }
    // The suffix is uneditable, so the client never needs an extension check.
    // Server's 422 guard stays as defense-in-depth.
    const finalName = `${trimmedBase}${renameExtSuffix}`;
    if (finalName === file.name) {
      cancelRename();
      return;
    }
    if (onRename) onRename(file.id, finalName);
    cancelRename();
  };
  useEffect(() => {
    return () => {
      if (renameErrorTimeoutRef.current) clearTimeout(renameErrorTimeoutRef.current);
    };
  }, []);
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
      {renameError && (
        <div
          role="alert"
          className="mb-3 px-4 py-2 bg-[#FF4444]/10 border border-[#FF4444]/30 rounded text-xs text-[#FF4444]"
        >
          {renameError}
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
            // When the inline preview / mini-player is active on this row, the
            // entire row is non-draggable. Sliders inside the player previously
            // bled mousedown events up to the draggable <tr> and initiated a
            // file move; flipping `draggable` off is the only fully reliable
            // way to stop HTML5 drag from being initiated on a slider thumb.
            const isPlayerOpen = playingFileId === file.id;
            const isRenaming = renamingFileId === file.id;
            const rowDraggable = !isPlayerOpen && !isRenaming;
            return (
              <tr
                key={file.id}
                draggable={rowDraggable}
                onDragStart={rowDraggable ? (e) => {
                  e.dataTransfer.setData("application/x-sb-file", file.id);
                  e.dataTransfer.effectAllowed = "move";
                  setDraggingFileId(file.id);
                } : undefined}
                onDragEnd={rowDraggable ? () => setDraggingFileId(null) : undefined}
                className={`border-b border-white/5 hover:bg-white/[0.03] transition-colors ${rowDraggable ? "cursor-grab" : ""} ${
                  draggingFileId === file.id ? "opacity-50" : ""
                }`}
              >
                <td className="py-2.5 px-3">
                  <div className="flex items-center gap-2">
                    <span className={`font-['Share_Tech_Mono',monospace] text-[10px] ${colorClass}`}>{icon}</span>
                    {renamingFileId === file.id ? (
                      // Single visual box: outer span owns the border + background,
                      // child input and suffix label are borderless and share the
                      // padding. focus-within highlights the whole box on focus.
                      <span className="inline-flex items-center bg-[#0F0F13] border border-[#00F0FF]/40 rounded px-1.5 py-0.5 focus-within:border-[#00F0FF] transition-colors">
                        <input
                          type="text"
                          autoFocus
                          value={renameDraft}
                          onChange={(e) => setRenameDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              submitRename(file);
                            } else if (e.key === "Escape") {
                              e.preventDefault();
                              cancelRename();
                            }
                          }}
                          onBlur={() => cancelRename()}
                          onClick={(e) => e.stopPropagation()}
                          className="bg-transparent border-none outline-none text-[#F0F0F0] text-sm font-mono w-[180px] p-0 m-0"
                          aria-label="Rename file (basename)"
                        />
                        {renameExtSuffix && (
                          <span
                            className="text-[#A0A0B0] text-sm font-mono"
                            style={{ userSelect: "none", pointerEvents: "none" }}
                            aria-label={`Extension (locked): ${renameExtSuffix}`}
                          >
                            {renameExtSuffix}
                          </span>
                        )}
                      </span>
                    ) : (
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
                    )}
                  </div>
                </td>
                <td className="py-2.5 px-3 text-[#A0A0B0] font-mono text-xs">{formatSize(file.size)}</td>
                <td className="py-2.5 px-3 text-[#A0A0B0] text-xs">{file.mimeType}</td>
                <td className="py-2.5 px-3 text-[#A0A0B0] text-xs">{file.uploaderName}</td>
                <td className="py-2.5 px-3 text-[#A0A0B0] text-xs">{new Date(file.uploadedAt).toLocaleDateString()}</td>
                <td className="py-2.5 px-3">
                  <div className="flex items-center justify-end gap-1">
                    {file.mimeType.startsWith("audio/") && (
                      // Audio player isolation: stop drag + mousedown from
                      // bubbling to the draggable <tr>. Without this, grabbing
                      // the seek bar or volume slider initiates a file move
                      // (round 2 BUG 3). draggable={false} blocks the slider
                      // thumb from being interpreted as a draggable element.
                      <div
                        className="flex items-center gap-2"
                        draggable={false}
                        onDragStart={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
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
                    {onRename && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startRename(file)}
                        aria-label={`Rename ${file.name}`}
                        title="Rename"
                      >
                        Rename
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
          Delete <span className="text-[#FF4444] font-medium">&quot;{deleteTarget?.name}&quot;</span>?
          This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
