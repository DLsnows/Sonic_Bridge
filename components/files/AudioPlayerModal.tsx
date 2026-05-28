"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Modal } from "@/components/ui/Modal";
import type { FileItem } from "./types";

interface AudioPlayerModalProps {
  file: FileItem;
  projectId: string;
  onClose: () => void;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}

export function AudioPlayerModal({ file, projectId, onClose }: AudioPlayerModalProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  const fileUrl = `/api/projects/${projectId}/files/${file.id}?inline=1`;

  const cleanup = useCallback(() => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
  }, []);

  useEffect(() => {
    const audio = new Audio(fileUrl);
    audio.preload = "auto";
    audio.volume = volume;
    audioRef.current = audio;

    audio.addEventListener("canplay", () => {
      setLoading(false);
      setDuration(audio.duration || 0);
    });
    audio.addEventListener("ended", () => setPlaying(false));
    audio.addEventListener("error", () => {
      setError("Playback failed");
      setLoading(false);
    });

    const updateTime = () => {
      if (audioRef.current) {
        setCurrentTime(audioRef.current.currentTime);
        animationRef.current = requestAnimationFrame(updateTime);
      }
    };
    audio.addEventListener("play", () => {
      setPlaying(true);
      animationRef.current = requestAnimationFrame(updateTime);
    });
    audio.addEventListener("pause", () => {
      setPlaying(false);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    });

    audio.play().catch(() => { setLoading(false); });

    return cleanup;
  }, [fileUrl, cleanup]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => setError("Playback failed"));
    }
  };

  const handleSeek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolume = (vol: number) => {
    setVolume(vol);
    if (audioRef.current) audioRef.current.volume = vol;
  };

  return (
    <Modal open onClose={() => { cleanup(); onClose(); }} title="Audio Player">
      <div className="space-y-4 py-4">
        <div className="text-center">
          <p className="text-sm text-[#F0F0F0] font-medium truncate">{file.name}</p>
          <p className="text-[10px] text-[#A0A0B0]">
            {file.mimeType} &middot; {formatSize(file.size)}
          </p>
        </div>

        {error && (
          <p className="text-xs text-[#FF4444] text-center">{error}</p>
        )}

        {loading && (
          <p className="text-xs text-[#A0A0B0] text-center">Loading audio...</p>
        )}

        <div className="space-y-3">
          {/* Progress bar */}
          <div className="space-y-1">
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={currentTime}
              onChange={(e) => handleSeek(parseFloat(e.target.value))}
              disabled={loading}
              className="w-full h-1.5 appearance-none bg-white/10 rounded-full outline-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#00F0FF]"
            />
            <div className="flex justify-between">
              <span className="text-[10px] text-[#A0A0B0] font-mono">{formatTime(currentTime)}</span>
              <span className="text-[10px] text-[#A0A0B0] font-mono">{formatTime(duration)}</span>
            </div>
          </div>

          {/* Play/Pause button */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={togglePlay}
              disabled={loading}
              className="w-12 h-12 rounded-full bg-[#00F0FF]/15 border-2 border-[#00F0FF]/30 flex items-center justify-center text-[#00F0FF] text-lg hover:bg-[#00F0FF]/25 transition-colors disabled:opacity-30"
            >
              {playing ? "⏸" : "▶"}
            </button>
          </div>

          {/* Volume */}
          <div className="flex items-center gap-2 justify-center">
            <button
              onClick={() => handleVolume(volume === 0 ? 1 : 0)}
              className="text-sm text-[#A0A0B0] hover:text-[#F0F0F0]"
            >
              {volume === 0 ? "🔇" : volume < 0.5 ? "🔉" : "🔊"}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => handleVolume(parseFloat(e.target.value))}
              className="w-24 h-1 appearance-none bg-white/10 rounded-full outline-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5
                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#00F0FF]"
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}
