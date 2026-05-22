"use client";

import { useState, useRef } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { getMaxFileSize, SIZE_LIMITS } from "@/lib/storage";

interface UploadZoneProps {
  projectId: string;
  folderId: string | null;
  onComplete: () => void;
  onClose: () => void;
}

export function UploadZone({ projectId, folderId, onComplete, onClose }: UploadZoneProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;
    const added: File[] = [];
    for (let i = 0; i < newFiles.length; i++) {
      const file = newFiles[i];
      const { limit, category } = getMaxFileSize(file.name);
      if (file.size > limit) {
        const limitStr = limit >= 1073741824 ? `${(limit / 1073741824).toFixed(0)}GB` : `${(limit / 1048576).toFixed(0)}MB`;
        setError(`File "${file.name}" exceeds ${limitStr} limit for ${category} files`);
        return;
      }
      added.push(file);
    }
    setSelectedFiles((prev) => [...prev, ...added]);
    setError("");
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;
    setUploading(true);
    setError("");

    const uploadedKeys: string[] = [];

    try {
      for (const file of selectedFiles) {
        setProgress((prev) => ({ ...prev, [file.name]: 0 }));

        const presignRes = await fetch(
          `/api/projects/${projectId}/files/upload-url?filename=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(file.type)}`
        );
        if (!presignRes.ok) {
          const data = await presignRes.json().catch(() => ({}));
          throw new Error(data.error || "Failed to get upload URL");
        }
        const { url, fields, storageKey } = await presignRes.json();
        uploadedKeys.push(storageKey);

        const formData = new FormData();
        for (const [key, value] of Object.entries(fields)) {
          formData.append(key, value as string);
        }
        formData.append("file", file);

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.upload.addEventListener("progress", (e) => {
            if (e.lengthComputable) {
              setProgress((prev) => ({ ...prev, [file.name]: Math.round((e.loaded / e.total) * 100) }));
            }
          });
          xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(new Error(`Upload failed: HTTP ${xhr.status}`));
          });
          xhr.addEventListener("error", () => reject(new Error("Upload failed: network error")));
          xhr.open("POST", url);
          xhr.send(formData);
        });

        setProgress((prev) => ({ ...prev, [file.name]: 100 }));
      }

      const metadataRes = await fetch(`/api/projects/${projectId}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: selectedFiles.map((f, i) => ({
            name: f.name,
            size: f.size,
            mimeType: f.type,
            storageKey: uploadedKeys[i],
          })),
          folderId,
        }),
      });

      if (metadataRes.ok) {
        onComplete();
      } else {
        const data = await metadataRes.json().catch(() => ({}));
        setError(data.error || "Failed to save file metadata");
      }
    } catch (err) {
      console.error("Upload failed:", err);
      setError(err instanceof Error ? err.message : "Upload failed");
    }
    setUploading(false);
  };

  return (
    <Modal open onClose={onClose} title="Upload Files">
      <div className="space-y-4">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
            dragOver ? "border-[#00FF41] bg-[#00FF41]/5 shadow-[0_0_15px_rgba(0,255,65,0.15)]" : "border-white/20 hover:border-[#00FF41]/50 hover:bg-white/[0.02]"
          }`}
          onClick={() => inputRef.current?.click()}
        >
          <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
          <p className="text-sm text-[#A0A0B0]">Drag files here or <span className="text-[#00FF41]">click to browse</span></p>
          <p className="text-[10px] text-[#A0A0B0]/60 mt-1">Audio ≤120MB · Video ≤500MB · Archive ≤2GB · Other ≤100MB</p>
        </div>

        {selectedFiles.length > 0 && (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {selectedFiles.map((file, i) => (
              <div key={i} className="flex items-center justify-between bg-white/5 rounded px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#F0F0F0] truncate">{file.name}</p>
                  <p className="text-[10px] text-[#A0A0B0]">
                    {(file.size / 1024 / 1024).toFixed(1)} MB
                    {uploading && progress[file.name] !== undefined && ` · ${progress[file.name]}%`}
                  </p>
                  {uploading && progress[file.name] !== undefined && (
                    <div className="w-full h-1 bg-white/10 rounded mt-1">
                      <div className="h-1 bg-[#00FF41] rounded transition-all" style={{ width: `${progress[file.name]}%` }} />
                    </div>
                  )}
                </div>
                {!uploading && (
                  <button onClick={() => removeFile(i)} className="text-[#FF4444] text-xs ml-2 shrink-0">Remove</button>
                )}
              </div>
            ))}
          </div>
        )}

        {error && <p className="text-sm text-[#FF4444]">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleUpload} loading={uploading} disabled={selectedFiles.length === 0}>Upload</Button>
        </div>
      </div>
    </Modal>
  );
}
