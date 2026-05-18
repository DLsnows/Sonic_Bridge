"use client";

import { useState, FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

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
            focus:outline-none focus:border-[#FF8C00]/50 focus:shadow-[0_0_15px_rgba(0,255,65,0.1)]
            hover:border-white/20"
        />
        <p className="text-xs text-[#A0A0B0]/60">
          Styling with Markdown is supported -- **bold**, *italic*, `code`, [links](url)
        </p>
      </div>

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
