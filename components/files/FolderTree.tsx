"use client";

import { useState } from "react";
import type { Folder } from "./types";

interface TreeNode {
  id: string | null;
  name: string;
  children: TreeNode[];
}

interface FolderTreeProps {
  folders: Folder[];
  currentFolderId: string | null;
  onSelect: (folderId: string | null) => void;
  onRename: (folderId: string, currentName: string) => void;
  onDelete: (folderId: string, folderName: string) => void;
  onMoveFile?: (fileId: string, targetFolderId: string | null) => void;
}

const SB_FILE_MIME = "application/x-sb-file";

function dataTransferHasFile(dt: DataTransfer): boolean {
  return Array.from(dt.types).includes(SB_FILE_MIME);
}

export function FolderTree({ folders, currentFolderId, onSelect, onRename, onDelete, onMoveFile }: FolderTreeProps) {
  function buildTree(parentId: string | null): TreeNode[] {
    const children = folders.filter((f) => f.parentId === parentId);
    return children.map((f) => ({
      id: f.id,
      name: f.name,
      children: buildTree(f.id),
    }));
  }

  function isAncestor(folderId: string | null): boolean {
    if (folderId === null) return true;
    if (!currentFolderId) return false;
    let current = folders.find((f) => f.id === currentFolderId);
    while (current?.parentId) {
      if (current.parentId === folderId) return true;
      current = folders.find((f) => f.id === current!.parentId!);
    }
    return false;
  }

  const tree: TreeNode[] = [
    { id: null, name: "Root", children: buildTree(null) },
  ];

  function TreeNodeItem({ node, depth }: { node: TreeNode; depth: number }) {
    const isCurrent = currentFolderId === node.id;
    const hasChildren = node.children.length > 0;
    const [expanded, setExpanded] = useState(node.id === null || isAncestor(node.id));
    const [isDropTarget, setIsDropTarget] = useState(false);

    const handleDragOver = (e: React.DragEvent<HTMLButtonElement>) => {
      if (!onMoveFile || !dataTransferHasFile(e.dataTransfer)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (!isDropTarget) setIsDropTarget(true);
    };
    const handleDragLeave = (e: React.DragEvent<HTMLButtonElement>) => {
      const next = e.relatedTarget as Node | null;
      if (next && e.currentTarget.contains(next)) return; // still inside
      setIsDropTarget(false);
    };
    const handleDrop = (e: React.DragEvent<HTMLButtonElement>) => {
      e.preventDefault();
      setIsDropTarget(false);
      if (!onMoveFile) return;
      const fileId = e.dataTransfer.getData(SB_FILE_MIME);
      if (!fileId) return;
      if (node.id === currentFolderId) return;
      onMoveFile(fileId, node.id);
    };

    return (
      <div>
        <button
          className={`group w-full text-left px-2 py-1.5 rounded text-xs font-mono flex items-center gap-1.5 transition-colors
            ${isCurrent ? "bg-[#00FF41]/10 text-[#00FF41]" : "text-[#A0A0B0] hover:text-[#F0F0F0] hover:bg-white/5"}
            ${isDropTarget ? "ring-2 ring-[#00FF41] bg-[#00FF41]/5" : ""}`}
          style={{ paddingLeft: `${8 + depth * 12}px` }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => {
            if (hasChildren) setExpanded(!expanded);
            onSelect(node.id);
          }}
        >
          {hasChildren && (
            <span className="text-[10px] w-3 text-center leading-none">
              {expanded ? "▼" : "▶"}
            </span>
          )}
          {!hasChildren && <span className="w-3" />}
          <span className="truncate">{node.name}</span>
          {node.id !== null && (
            <span className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <button
                onClick={(e) => { e.stopPropagation(); onRename(node.id!, node.name); }}
                className="text-[10px] text-[#A0A0B0] hover:text-[#00FF41] px-1"
                title="Rename"
              >✎</button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(node.id!, node.name); }}
                className="text-[10px] text-[#A0A0B0] hover:text-[#FF4444] px-1"
                title="Delete"
              >✕</button>
            </span>
          )}
        </button>
        {expanded && hasChildren &&
          node.children.map((child) => (
            <TreeNodeItem key={child.id} node={child} depth={depth + 1} />
          ))}
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      <h4 className="font-['Share_Tech_Mono',monospace] text-[10px] text-[#A0A0B0] uppercase tracking-wider px-2 mb-2">
        Folders
      </h4>
      {tree.map((node) => (
        <TreeNodeItem key={node.id ?? "__root__"} node={node} depth={0} />
      ))}
    </div>
  );
}