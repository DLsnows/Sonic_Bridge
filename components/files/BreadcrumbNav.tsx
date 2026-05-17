"use client";

import type { Folder } from "./types";

interface BreadcrumbNavProps {
  folders: Folder[];
  currentFolderId: string | null;
  onNavigate: (folderId: string | null) => void;
}

export function BreadcrumbNav({
  folders,
  currentFolderId,
  onNavigate,
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
      {path.map((segment, i) => {
        const isLast = i === path.length - 1;
        return (
          <div key={segment.id ?? "__root__"} className="flex items-center gap-1">
            {i > 0 && (
              <span className="text-[#A0A0B0]/50 text-xs">&gt;</span>
            )}
            {isLast ? (
              <span className="font-['Share_Tech_Mono',monospace] text-xs text-[#00F0FF]">
                {segment.name}
              </span>
            ) : (
              <button
                className="font-['Share_Tech_Mono',monospace] text-xs text-[#A0A0B0] hover:text-[#F0F0F0] transition-colors"
                onClick={() => onNavigate(segment.id)}
              >
                {segment.name}
              </button>
            )}
          </div>
        );
      })}
    </nav>
  );
}