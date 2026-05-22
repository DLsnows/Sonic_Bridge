"use client";

import { useState, FormEvent, useRef, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import MDEditor from "@uiw/react-md-editor";
import "@uiw/react-md-editor/markdown-editor.css";

interface PostFormProps {
  mode: "thread" | "reply" | "edit";
  initialTitle?: string;
  initialContent?: string;
  availableFiles?: { id: string; name: string }[];
  projectId?: string;
  onSubmit: (data: { title: string; content: string }) => Promise<void>;
  onCancel?: () => void;
}

export function PostForm({
  mode,
  initialTitle = "",
  initialContent = "",
  availableFiles,
  projectId,
  onSubmit,
  onCancel,
}: PostFormProps) {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showFilePicker, setShowFilePicker] = useState(false);

  const DRAFT_KEY = `discussion-draft-${projectId}`;
  const [draftRestored, setDraftRestored] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (mode === "edit") return;
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const draft = JSON.parse(saved);
        requestAnimationFrame(() => {
          if (draft.title) setTitle(draft.title);
          if (draft.content) setContent(draft.content);
          setDraftRestored(true);
        });
      }
    } catch {}
  }, [DRAFT_KEY, mode]);

  useEffect(() => {
    if (mode === "edit") return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (title || content) localStorage.setItem(DRAFT_KEY, JSON.stringify({ title, content }));
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [title, content, DRAFT_KEY, mode]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!content.trim()) {
      setError("Content is required.");
      return;
    }

    if (mode === "thread" && !title.trim()) {
      setError("Title is required.");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({ title: title.trim(), content: content.trim() });
      if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
      localStorage.removeItem(DRAFT_KEY);
      if (mode !== "edit") {
        setTitle("");
        setContent("");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const insertCitation = (fileId: string, fileName: string) => {
    const safeName = fileName.replace(/[[\]()]/g, "\\$&");
    const citation = `[${safeName}](/projects/${projectId}/files?file=${fileId})`;
    setContent((prev) => prev + " " + citation);
    setShowFilePicker(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {mode === "thread" && (
        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What's on your mind?"
          maxLength={200}
        />
      )}

      <div className="flex flex-col gap-1.5">
        {availableFiles && availableFiles.length > 0 && projectId && (
          <div className="relative self-end">
            <button
              type="button"
              onClick={() => setShowFilePicker(!showFilePicker)}
              className="text-[10px] text-[#FF8C00]/70 hover:text-[#FF8C00] font-mono transition-colors"
            >
              {showFilePicker ? "Close" : "+ Cite File"}
            </button>
            {showFilePicker && (
              <div className="absolute top-6 right-0 bg-[#0A0A0F] border border-white/10 rounded-lg shadow-lg z-50 w-56 max-h-40 overflow-y-auto">
                {availableFiles.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => insertCitation(f.id, f.name)}
                    className="w-full text-left px-3 py-1.5 text-xs text-[#D0D0D0] hover:bg-white/5 truncate"
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <div data-color-mode="dark">
          <MDEditor
            value={content}
            onChange={(val) => setContent(val ?? "")}
            preview={mode === "edit" ? "edit" : "live"}
            height={mode === "thread" ? 250 : 200}
            visibleDragbar={false}
            textareaProps={{
              placeholder:
                mode === "reply"
                  ? "Write a reply..."
                  : mode === "edit"
                    ? "Edit your post..."
                    : "Share your thoughts... (Markdown supported)",
              maxLength: 10000,
            }}
          />
        </div>
      </div>

      {draftRestored && <p className="text-[10px] text-[#FF8C00]/70 mb-2">Draft restored</p>}

      {error && <p className="text-xs text-[#FF4444]">{error}</p>}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button variant="ghost" size="sm" type="button" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button variant="primary" size="sm" type="submit" loading={submitting}>
          {mode === "thread" ? "Post Thread" : mode === "reply" ? "Reply" : "Save"}
        </Button>
      </div>
    </form>
  );
}
