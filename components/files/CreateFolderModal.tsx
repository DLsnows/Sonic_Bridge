"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { Folder } from "./types";

interface CreateFolderModalProps {
  projectId: string;
  folders: Folder[];
  currentFolderId: string | null;
  onCreated: () => void;
  onClose: () => void;
}

export function CreateFolderModal({
  projectId,
  folders,
  currentFolderId,
  onCreated,
  onClose,
}: CreateFolderModalProps) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const parentFolder = currentFolderId
    ? folders.find((f) => f.id === currentFolderId)
    : null;

  const create = async () => {
    if (!name.trim()) return;
    setLoading(true);
    setError("");

    const body: { name: string; parentId?: string } = { name: name.trim() };
    if (currentFolderId) body.parentId = currentFolderId;

    const res = await fetch(`/api/projects/${projectId}/folders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      onCreated();
    } else {
      const data = await res.json();
      setError(data.error ?? "Failed to create folder");
    }
    setLoading(false);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Create Folder"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={create} loading={loading}>Create</Button>
        </>
      }
    >
      <div className="space-y-4">
        {parentFolder ? (
          <p className="text-xs text-[#A0A0B0]">
            Parent: <span className="text-[#00F0FF]">{parentFolder.name}</span>
          </p>
        ) : (
          <p className="text-xs text-[#A0A0B0]">
            Parent: <span className="text-[#A0A0B0]">Root</span>
          </p>
        )}
        <Input
          label="Folder Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") create(); }}
          error={error}
        />
      </div>
    </Modal>
  );
}