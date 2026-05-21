"use client";

import { useState, FormEvent, useRef, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (title || content) localStorage.setItem(DRAFT_KEY, JSON.stringify({ title, content }));
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [title, content, DRAFT_KEY]);

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
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const currentValue = textarea.value;
      const newContent = currentValue.slice(0, start) + citation + currentValue.slice(end);
      setContent(newContent);
      // Restore cursor position after citation
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + citation.length, start + citation.length);
      }, 0);
    } else {
      setContent((prev) => prev + " " + citation);
    }
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
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={
            mode === "reply"
              ? "Write a reply..."
              : mode === "edit"
                ? "Edit your post..."
                : "Share your thoughts... (Markdown supported)"
          }
          rows={mode === "thread" ? 5 : 4}
          maxLength={10000}
          className="w-full px-3 py-2 bg-[#0F0F13] border border-white/10 rounded-lg text-sm text-[#F0F0F0]
            placeholder:text-[#A0A0B0]/50 font-['Fira_Code',monospace]
            transition-all duration-200 resize-y min-h-[80px]
            focus:outline-none focus:border-[#FF8C00]/50 focus:shadow-[0_0_15px_rgba(255,140,0,0.1)]
            hover:border-white/20"
        />
        <div className="flex items-center justify-between">
          <p className="text-xs text-[#A0A0B0]/60">
            Styling with Markdown is supported -- **bold**, *italic*, `code`, [links](url)
          </p>
          {availableFiles && availableFiles.length > 0 && projectId && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowFilePicker(!showFilePicker)}
                className="text-[10px] text-[#FF8C00]/70 hover:text-[#FF8C00] font-mono transition-colors"
              >
                {showFilePicker ? "Close" : "+ Cite File"}
              </button>
              {showFilePicker && (
                <div className="absolute bottom-6 right-0 bg-[#0A0A0F] border border-white/10 rounded-lg shadow-lg z-50 w-56 max-h-40 overflow-y-auto">
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
