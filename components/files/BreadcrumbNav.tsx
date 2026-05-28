"use client";

import { useState } from "react";
import type { Folder } from "./types";

interface BreadcrumbNavProps {
  folders: Folder[];
  currentFolderId: string | null;
  onNavigate: (folderId: string | null) => void;
  onMoveFile?: (fileId: string, targetFolderId: string | null) => void;
}

const SB_FILE_MIME = "application/x-sb-file";

function dataTransferHasFile(dt: DataTransfer): boolean {
  return Array.from(dt.types).includes(SB_FILE_MIME);
}

function BreadcrumbSegment({
  id,
  name,
  isLast,
  showSeparator,
  currentFolderId,
  onNavigate,
  onMoveFile,
}: {
  id: string | null;
  name: string;
  isLast: boolean;
  showSeparator: boolean;
  currentFolderId: string | null;
  onNavigate: (folderId: string | null) => void;
  onMoveFile?: (fileId: string, targetFolderId: string | null) => void;
}) {
  const [isDropTarget, setIsDropTarget] = useState(false);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (!onMoveFile || !dataTransferHasFile(e.dataTransfer)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (!isDropTarget) setIsDropTarget(true);
  };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    const next = e.relatedTarget as Node | null;
    if (next && e.currentTarget.contains(next)) return; // still inside
    setIsDropTarget(false);
  };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDropTarget(false);
    if (!onMoveFile) return;
    const fileId = e.dataTransfer.getData(SB_FILE_MIME);
    if (!fileId) return;
    onMoveFile(fileId, id);
  };

  return (
    <div
      className={`flex items-center gap-1 rounded px-1 ${
        isDropTarget ? "ring-2 ring-[#00FF41] bg-[#00FF41]/5" : ""
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {showSeparator && (
        <span className="text-[#A0A0B0]/50 text-xs">&gt;</span>
      )}
      {isLast ? (
        <span className="font-['Share_Tech_Mono',monospace] text-xs text-[#00FF41]">
          {name}
        </span>
      ) : (
        <button
          className="font-['Share_Tech_Mono',monospace] text-xs text-[#A0A0B0] hover:text-[#F0F0F0] transition-colors"
          onClick={() => onNavigate(id)}
        >
          {name}
        </button>
      )}
    </div>
  );
}

export function BreadcrumbNav({
  folders,
  currentFolderId,
  onNavigate,
  onMoveFile,
}: BreadcrumbNavProps) {
  const path: { id: string | null; name: string }[] = [{ id: null, name: "Root" }];

  if (currentFolderId) {
    const chain: { id: string; name: string }[] = [];
    let current = folders.find((f) => f.id === currentFolderId);
    while (current) {
      chain.unshift({ id: current.id, name: current.name });
      current = current.parentId
        ? folders.find((f) => f.id === current!.parentId)
        : undefined;
    }
    path.push(...chain);
  }

  return (
    <nav className="flex items-center gap-1 px-4 py-2 border-b border-white/10 bg-[#0A0A0F]/30">
      {path.map((segment, i) => (
        <BreadcrumbSegment
          key={segment.id ?? "__root__"}
          id={segment.id}
          name={segment.name}
          isLast={i === path.length - 1}
          showSeparator={i > 0}
          currentFolderId={currentFolderId}
          onNavigate={onNavigate}
          onMoveFile={onMoveFile}
        />
      ))}
    </nav>
  );
}