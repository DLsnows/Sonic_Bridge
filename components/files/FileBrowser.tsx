"use client";

import { useState, useCallback, useEffect } from "react";
import { FolderTree } from "./FolderTree";
import { FileList } from "./FileList";
import { UploadZone } from "./UploadZone";
import { BreadcrumbNav } from "./BreadcrumbNav";
import { CreateFolderModal } from "./CreateFolderModal";
import { AudioPlayerModal } from "./AudioPlayerModal";
import { Button } from "@/components/ui/Button";
import type { Folder, FileItem } from "./types";

interface FileBrowserProps {
  projectId: string;
  userId: string;
  initialFolders: Folder[];
}

export function FileBrowser({ projectId, initialFolders }: FileBrowserProps) {
  const [folders, setFolders] = useState<Folder[]>(initialFolders);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [playerFile, setPlayerFile] = useState<FileItem | null>(null);

  const fetchFiles = useCallback(async (folderId: string | null) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (folderId) params.set("folderId", folderId);
    const res = await fetch(`/api/projects/${projectId}/files?${params}`);
    if (res.ok) { const data = await res.json(); setFiles(data.files); }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    let ignore = false;
    (async () => {
      setLoading(true);
      const params = new URLSearchParams();
      if (currentFolderId) params.set("folderId", currentFolderId);
      const res = await fetch(`/api/projects/${projectId}/files?${params}`);
      if (!ignore && res.ok) { const data = await res.json(); setFiles(data.files); }
      if (!ignore) setLoading(false);
    })();
    return () => { ignore = true; };
  }, [currentFolderId, projectId]);

  const refreshFolders = async () => {
    const res = await fetch(`/api/projects/${projectId}/folders`);
    if (res.ok) { const data = await res.json(); setFolders(data.folders); }
  };

  const handleFolderCreated = async () => { setShowCreateFolder(false); await refreshFolders(); };
  const handleUploadComplete = () => { setShowUpload(false); fetchFiles(currentFolderId); };
  const handleDelete = async (fileId: string) => {
    const res = await fetch(`/api/projects/${projectId}/files/${fileId}`, { method: "DELETE" });
    if (res.ok) fetchFiles(currentFolderId);
  };
  const handleDownload = async (fileId: string, fileName: string) => {
    try {
      const check = await fetch(`/api/projects/${projectId}/files/${fileId}`, { method: "HEAD" });
      if (!check.ok) {
        if (check.status === 404) { alert("File not found"); return; }
        alert(`Download failed (HTTP ${check.status})`);
        return;
      }
    } catch {
      alert("Download failed: Network error");
      return;
    }
    const a = document.createElement("a");
    a.href = `/api/projects/${projectId}/files/${fileId}`;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleRenameFolder = (folderId: string, currentName: string) => {
    const newName = prompt("New folder name:", currentName);
    if (!newName || newName === currentName) return;
    fetch(`/api/projects/${projectId}/folders/${folderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    }).then((res) => { if (res.ok) refreshFolders(); });
  };

  const handleMoveFile = useCallback(
    async (fileId: string, targetFolderId: string | null) => {
      const previous = files;
      const moved = previous.find((f) => f.id === fileId);
      if (!moved) return;
      if ((moved.folderId ?? null) === targetFolderId) return;

      // Optimistic: remove from current view immediately.
      setFiles((prev) => prev.filter((f) => f.id !== fileId));

      try {
        const res = await fetch(
          `/api/projects/${projectId}/files/${fileId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ folderId: targetFolderId }),
          },
        );
        if (!res.ok) {
          let message = `Move failed (HTTP ${res.status})`;
          try {
            const data = (await res.json()) as { error?: string };
            if (data?.error) message = data.error;
          } catch {
            // body wasn't JSON; keep default message
          }
          setFiles(previous);
          alert(message);
        }
      } catch (err) {
        setFiles(previous);
        alert(
          err instanceof Error ? err.message : "Move failed: network error",
        );
      }
    },
    [files, projectId],
  );

  const handleDeleteFolder = (folderId: string, folderName: string) => {
    if (!confirm(`Delete folder "${folderName}" and all its contents?`)) return;
    fetch(`/api/projects/${projectId}/folders/${folderId}`, { method: "DELETE" })
      .then((res) => {
        if (res.ok) {
          if (currentFolderId === folderId) setCurrentFolderId(null);
          refreshFolders();
          fetchFiles(null);
        }
      });
  };

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      <aside className="w-56 border-r border-[#00FF41]/10 bg-[#0A0A0F]/50 p-3 flex flex-col">
        <FolderTree folders={folders} currentFolderId={currentFolderId} onSelect={setCurrentFolderId} onRename={handleRenameFolder} onDelete={handleDeleteFolder} onMoveFile={handleMoveFile} />
        <Button variant="ghost" size="sm" className="mt-2" onClick={() => setShowCreateFolder(true)}>
          + New Folder
        </Button>
      </aside>
      <main className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between pr-4">
          <BreadcrumbNav folders={folders} currentFolderId={currentFolderId} onNavigate={setCurrentFolderId} onMoveFile={handleMoveFile} />
        </div>
        <div className="flex-1 overflow-auto p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-['Share_Tech_Mono',monospace] text-sm text-[#00FF41]">
              {currentFolderId ? folders.find((f) => f.id === currentFolderId)?.name ?? "Files" : "Root"}
            </h3>
            <Button size="sm" variant="primary" onClick={() => setShowUpload(true)}>Upload Files</Button>
          </div>
          <FileList files={files} loading={loading} projectId={projectId} onDelete={handleDelete} onDownload={handleDownload} onOpenPlayer={(file) => setPlayerFile(file)} />
        </div>
      </main>
      {showUpload && <UploadZone projectId={projectId} folderId={currentFolderId} onComplete={handleUploadComplete} onClose={() => setShowUpload(false)} />}
      {showCreateFolder && <CreateFolderModal projectId={projectId} folders={folders} currentFolderId={currentFolderId} onCreated={handleFolderCreated} onClose={() => setShowCreateFolder(false)} />}
      {playerFile && (
        <AudioPlayerModal
          file={playerFile}
          projectId={projectId}
          onClose={() => setPlayerFile(null)}
        />
      )}
    </div>
  );
}
