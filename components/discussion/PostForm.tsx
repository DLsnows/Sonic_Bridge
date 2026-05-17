"use client";

import { useState, FormEvent } from "react";
import { Button } from "@/components/ui/Button";

interface PostFormProps {
  mode: "thread" | "reply" | "edit";
  initialTitle?: string;
  initialContent?: string;
  onSubmit: (data: { title: string; content: string }) => Promise<void>;
  onCancel?: () => void;
}

export function PostForm({
  mode,
  initialTitle = "",
  initialContent = "",
  onSubmit,
  onCancel,
}: PostFormProps) {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
      if (mode !== "edit") {
        setTitle("");
        setContent("");
      }
    } catch (err: any) {
      setError(err.message ?? "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {mode === "thread" && (
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Thread title"
          maxLength={200}
          className="w-full px-3 py-2 bg-[#0F0F13] border border-white/10 rounded-lg text-sm text-[#F0F0F0]
            placeholder:text-[#A0A0B0]/50 font-['Fira_Code',monospace]
            transition-all duration-200
            focus:outline-none focus:border-[#00FF41]/50 focus:shadow-[0_0_15px_rgba(0,255,65,0.1)]
            hover:border-white/20"
        />
      )}

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={
          mode === "reply"
            ? "Write a reply... (Markdown supported)"
            : mode === "edit"
              ? "Edit your post..."
              : "Write your post... (Markdown supported)"
        }
        maxLength={10000}
        rows={mode === "thread" ? 6 : 4}
        className="w-full px-3 py-2 bg-[#0F0F13] border border-white/10 rounded-lg text-sm text-[#F0F0F0]
          placeholder:text-[#A0A0B0]/50 font-['Fira_Code',monospace] resize-y min-h-[80px]
          transition-all duration-200
          focus:outline-none focus:border-[#00FF41]/50 focus:shadow-[0_0_15px_rgba(0,255,65,0.1)]
          hover:border-white/20"
      />

      {error && <p className="text-xs text-[#FF4444]">{error}</p>}

      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[#A0A0B0]/60">
          Markdown supported: **bold**, *italic*, `code`, ```block```
        </span>
        <div className="flex gap-2">
          {onCancel && (
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" variant="primary" size="sm" loading={submitting}>
            {mode === "thread" ? "Create Thread" : mode === "edit" ? "Save Changes" : "Reply"}
          </Button>
        </div>
      </div>
    </form>
  );
}
