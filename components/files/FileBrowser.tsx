"use client";

import { useState, useCallback, useEffect, useRef } from "react";
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
  // Per-file in-flight rename guard. A second rename on the same file is
  // refused until the first PATCH resolves, so a failure-then-success race
  // can't replace a successful rename with a stale rollback.
  const renamingRef = useRef<Set<string>>(new Set());

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
    // File deletion now requires a fresh password-derived challenge token.
    const password = prompt("Confirm your password to delete this file:");
    if (!password) return;
    const verify = await fetch(`/api/user/verify-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!verify.ok) {
      // Branch on the error envelope so a server-side failure (e.g. missing
      // delete_challenges table, DB outage) is not mis-labeled as a credential
      // problem. Round 2 BUGS 5 + 6 were caused by this confusion.
      let body: { error?: string; message?: string } = {};
      try { body = await verify.json(); } catch { /* ignore */ }
      if (verify.status === 429) {
        alert("Too many failed attempts. Try again later.");
      } else if (verify.status === 401 && body.error === "Invalid password") {
        alert("Incorrect password.");
      } else if (verify.status === 503 && body.error === "challenge_mint_failed") {
        alert(
          body.message ??
            "Server error minting challenge. Please try again, or contact an admin.",
        );
      } else {
        alert(`Could not start delete (HTTP ${verify.status}).`);
      }
      return;
    }
    const { challenge } = await verify.json();
    const res = await fetch(`/api/projects/${projectId}/files/${fileId}`, {
      method: "DELETE",
      headers: { "X-Delete-Challenge": challenge },
    });
    if (res.ok) fetchFiles(currentFolderId);
    else alert(`Failed to delete file (HTTP ${res.status})`);
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

  const handleRenameFile = useCallback(
    async (fileId: string, newName: string) => {
      // Serialize per-file: refuse a second rename while one is in-flight.
      if (renamingRef.current.has(fileId)) return;
      const target = files.find((f) => f.id === fileId);
      if (!target) return;
      if (target.name === newName) return;
      const previousName = target.name;
      renamingRef.current.add(fileId);

      // Optimistic update.
      setFiles((prev) =>
        prev.map((f) => (f.id === fileId ? { ...f, name: newName } : f)),
      );

      try {
        const res = await fetch(
          `/api/projects/${projectId}/files/${fileId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: newName }),
          },
        );
        if (!res.ok) {
          // Roll back the optimistic state — but only if the current state
          // still reflects OUR optimistic write. If another rename succeeded
          // in the meantime (shouldn't happen with the renamingRef guard
          // above, but belt-and-suspenders), don't stomp it.
          setFiles((prev) =>
            prev.map((f) =>
              f.id === fileId && f.name === newName
                ? { ...f, name: previousName }
                : f,
            ),
          );
          if (res.status === 422) {
            try {
              const data = (await res.json()) as {
                error?: string;
                currentExt?: string;
                newExt?: string;
              };
              if (data?.error === "extension_change_not_allowed") {
                const cur = data.currentExt ? `.${data.currentExt}` : "(none)";
                const nxt = data.newExt ? `.${data.newExt}` : "(none)";
                alert(`Extension cannot be changed (${cur} → ${nxt})`);
                return;
              }
            } catch {
              // fall through to generic
            }
          }
          alert(`Rename failed (HTTP ${res.status})`);
        }
      } catch (err) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileId && f.name === newName
              ? { ...f, name: previousName }
              : f,
          ),
        );
        alert(
          err instanceof Error ? err.message : "Rename failed: network error",
        );
      } finally {
        renamingRef.current.delete(fileId);
      }
    },
    [files, projectId],
  );

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
      const previous = [...files];
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
          setFiles((prev) => {
            if (prev.some((f) => f.id === fileId)) return prev;
            const movedFile = previous.find((f) => f.id === fileId);
            return movedFile ? [...prev, movedFile] : prev;
          });
          alert(message);
        }
      } catch (err) {
        setFiles((prev) => {
          if (prev.some((f) => f.id === fileId)) return prev;
          const movedFile = previous.find((f) => f.id === fileId);
          return movedFile ? [...prev, movedFile] : prev;
        });
        alert(
          err instanceof Error ? err.message : "Move failed: network error",
        );
      }
    },
    [files, projectId],
  );

  const handleDeleteFolder = (folderId: string, folderName: string) => {
    // Folder DELETE no longer cascades: the user must empty the folder first.
    if (!confirm(`Delete empty folder "${folderName}"?`)) return;
    fetch(`/api/projects/${projectId}/folders/${folderId}`, { method: "DELETE" })
      .then(async (res) => {
        if (res.ok) {
          if (currentFolderId === folderId) setCurrentFolderId(null);
          refreshFolders();
          fetchFiles(null);
          return;
        }
        if (res.status === 409) {
          alert(`Folder is not empty. Please delete its files and subfolders first.`);
          return;
        }
        alert(`Failed to delete folder (HTTP ${res.status})`);
      })
      .catch(() => alert("Failed to delete folder: Network error"));
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
          <FileList files={files} loading={loading} projectId={projectId} onDelete={handleDelete} onDownload={handleDownload} onRename={handleRenameFile} onOpenPlayer={(file) => setPlayerFile(file)} />
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
