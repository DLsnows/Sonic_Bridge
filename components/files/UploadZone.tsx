"use client";

import { useState, useRef, useCallback } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

interface UploadZoneProps {
  projectId: string;
  folderId: string | null;
  onComplete: () => void;
  onClose: () => void;
}

const MAX_FILE_SIZE = 100 * 1024 * 1024;

export function UploadZone({ projectId, folderId, onComplete, onClose }: UploadZoneProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((fileList: FileList) => {
    setError("");
    const incoming = Array.from(fileList);
    const overSize = incoming.find((f) => f.size > MAX_FILE_SIZE);
    if (overSize) {
      setError(`"${overSize.name}" exceeds 100MB limit`);
      return;
    }
    setSelectedFiles((prev) => [...prev, ...incoming]);
  }, []);

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const upload = async () => {
    if (selectedFiles.length === 0) return;
    setUploading(true);
    setError("");

    const formData = new FormData();
    for (const f of selectedFiles) formData.append("files", f);
    if (folderId) formData.append("folderId", folderId);

    const res = await fetch(`/api/projects/${projectId}/files`, { method: "POST", body: formData });

    if (res.ok) {
      onComplete();
    } else {
      const data = await res.json();
      setError(data.error ?? "Upload failed");
    }
    setUploading(false);
  };

  return (
    <Modal open onClose={onClose} title="Upload Files"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={upload} loading={uploading} disabled={selectedFiles.length === 0}>
            Upload {selectedFiles.length > 0 && `(${selectedFiles.length})`}
          </Button>
        </>
      }>
      <div className="space-y-4">
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-all cursor-pointer
            ${dragOver ? "border-[#00FF41] bg-[#00FF41]/5 shadow-[0_0_20px_rgba(0,255,65,0.15)]"
              : "border-white/20 hover:border-[#00F0FF]/50 hover:bg-white/[0.02]"}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}>
          <div className="text-3xl mb-2">↑</div>
          <p className="text-sm text-[#A0A0B0]">Drop files here or <span className="text-[#00F0FF]">click to browse</span></p>
          <p className="text-[10px] text-[#A0A0B0]/60 mt-1">Max 100MB per file</p>
        </div>
        <input ref={inputRef} type="file" multiple className="hidden"
          onChange={(e) => { if (e.target.files && e.target.files.length > 0) addFiles(e.target.files); e.target.value = ""; }} />
        {selectedFiles.length > 0 && (
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {selectedFiles.map((file, i) => (
              <div key={`${file.name}-${i}`} className="flex items-center justify-between px-3 py-2 bg-white/5 rounded text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-[#00FF41] font-mono text-[10px]">
                    {file.type.startsWith("audio/") ? "SPEAKER" : file.type.startsWith("image/") ? "IMG" : "FILE"}
                  </span>
                  <span className="text-[#F0F0F0] truncate max-w-[250px]">{file.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[#A0A0B0] font-mono">{(file.size / 1024).toFixed(1)} KB</span>
                  <button className="text-[#FF4444] hover:text-[#FF6666]" onClick={(e) => { e.stopPropagation(); removeFile(i); }}>✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
        {error && <p className="text-xs text-[#FF4444]">{error}</p>}
      </div>
    </Modal>
  );
}