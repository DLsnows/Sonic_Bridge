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
}

export function FolderTree({ folders, currentFolderId, onSelect }: FolderTreeProps) {
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

    return (
      <div>
        <button
          className={`w-full text-left px-2 py-1.5 rounded text-xs font-mono flex items-center gap-1.5 transition-colors
            ${isCurrent ? "bg-[#00F0FF]/10 text-[#00F0FF]" : "text-[#A0A0B0] hover:text-[#F0F0F0] hover:bg-white/5"}`}
          style={{ paddingLeft: `${8 + depth * 12}px` }}
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
          <span>{node.name}</span>
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