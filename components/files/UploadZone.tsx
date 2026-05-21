"use client";

import { useState, useRef, useCallback } from "react";
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
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentFileIndex, setCurrentFileIndex] = useState(-1);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const addFiles = useCallback((fileList: FileList) => {
    setError("");
    const incoming = Array.from(fileList);
    const overSize = incoming.find((f) => {
      const { limit } = getMaxFileSize(f.name);
      return f.size > limit;
    });
    if (overSize) {
      const { limit, category } = getMaxFileSize(overSize.name);
      const limitStr = limit >= 1073741824 ? ${(limit / 1073741824).toFixed(0)}GB : ${(limit / 1048576).toFixed(0)}MB;
      setError("" exceeds  limit for  files);
      return;
    }
    setSelectedFiles((prev) => [...prev, ...incoming]);
  }, []);

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const cancelUpload = () => {
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
    setUploading(false);
    setCurrentFileIndex(-1);
  };

  const upload = () => {
    if (selectedFiles.length === 0) return;
    setUploading(true);
    setError("");
    setUploadProgress(0);
    setCurrentFileIndex(0);

    const formData = new FormData();
    for (const f of selectedFiles) formData.append("files", f);
    if (folderId) formData.append("folderId", folderId);

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.open("POST", /api/projects//files);

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        setUploadProgress(pct);
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onComplete();
      } else {
        let message = "Upload failed";
        try {
          const data = JSON.parse(xhr.responseText);
          message = data.error ?? message;
        } catch { /* not JSON */ }
        setError(message);
      }
      setUploading(false);
      setCurrentFileIndex(-1);
      xhrRef.current = null;
    });

    xhr.addEventListener("error", () => {
      setError("Network error during upload");
      setUploading(false);
      setCurrentFileIndex(-1);
      xhrRef.current = null;
    });

    xhr.addEventListener("abort", () => {
      setUploading(false);
      setCurrentFileIndex(-1);
      xhrRef.current = null;
    });

    xhr.send(formData);
  };

  return (
    <Modal open onClose={onClose} title="Upload Files"
      footer={
        <>
          <Button variant="ghost" onClick={uploading ? cancelUpload : onClose}>{uploading ? "Cancel" : "Close"}</Button>
          <Button onClick={upload} loading={uploading} disabled={selectedFiles.length === 0 || uploading}>
            Upload {selectedFiles.length > 0 && ()}
          </Button>
        </>
      }>
      <div className="space-y-4">
        <div
          className={order-2 border-dashed rounded-lg p-8 text-center transition-all cursor-pointer
            }
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}>
          <div className="text-3xl mb-2">{uploading ? "⏳" : "↑"}</div>
          <p className="text-sm text-[#A0A0B0]">Drop files here or <span className="text-[#00FF41]">click to browse</span></p>
          <p className="text-[10px] text-[#A0A0B0]/60 mt-1">{Audio MB / Archives GB / Video MB / Other MB}</p>
        </div>
        <input ref={inputRef} type="file" multiple className="hidden"
          onChange={(e) => { if (e.target.files && e.target.files.length > 0) addFiles(e.target.files); e.target.value = ""; }} />
        {selectedFiles.length > 0 && (
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {selectedFiles.map((file, i) => (
              <div key={${file.name}-} className="flex items-center justify-between px-3 py-2 bg-white/5 rounded text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-[#00FF41] font-mono text-[10px]">
                    {file.type.startsWith("audio/") ? "SPEAKER" : file.type.startsWith("image/") ? "IMG" : "FILE"}
                  </span>
                  <span className="text-[#F0F0F0] truncate max-w-[250px]">{file.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[#A0A0B0] font-mono">{(file.size / 1024).toFixed(1)} KB</span>
                  {!uploading && <button className="text-[#FF4444] hover:text-[#FF6666]" onClick={(e) => { e.stopPropagation(); removeFile(i); }}>✕</button>}
                </div>
              </div>
            ))}
          </div>
        )}
        {uploading && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] text-[#A0A0B0]">
              <span>Uploading{currentFileIndex >= 0 ?  / : ""}</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#00FF41] transition-all duration-300 rounded-full"
                style={{ width: ${uploadProgress}% }}
              />
            </div>
          </div>
        )}
        {error && (
          <div className="space-y-1">
            <p className="text-xs text-[#FF4444]">{error}</p>
            {(error.toLowerCase().includes("timeout") || error.toLowerCase().includes("duration")) && (
              <p className="text-[10px] text-[#FFB800]">The file may be too large for upload. Try a smaller file or a compressed format.</p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}