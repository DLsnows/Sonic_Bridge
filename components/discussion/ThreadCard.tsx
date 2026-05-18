"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/Button";
import { PostForm } from "./PostForm";

interface DiscussionPost {
  id: string;
  projectId: string;
  userId: string;
  username: string;
  title: string;
  content: string;
  parentId: string | null;
  isEdited: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ThreadCardProps {
  post: DiscussionPost;
  replies: DiscussionPost[];
  currentUserId: string;
  isAdmin: boolean;
  replyingTo: string | null;
  editingId: string | null;
  onReply: (parentId: string, content: string) => Promise<void>;
  onEdit: (postId: string, content: string) => Promise<void>;
  onDelete: (postId: string) => Promise<void>;
  onSetReplying: (id: string | null) => void;
  onSetEditing: (id: string | null) => void;
}

function stripMarkdown(md: string): string {
  return md
    .replace(/#{1,6}\s/g, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`{1,3}[^`]*`{1,3}/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[>|-]\s/g, "")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function timeAgo(dateStr: string): string {
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  } catch {
    return dateStr;
  }
}

const markdownComponents = {
  a: ({ href, children }: any) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[#00FF41] hover:underline"
    >
      {children}
    </a>
  ),
  code: ({ children, className }: any) => {
    if (className) {
      return (
        <pre className="bg-[#09090B] border border-[#00FF41]/10 rounded p-3 overflow-x-auto text-xs text-[#00F0FF] my-2">
          <code>{children}</code>
        </pre>
      );
    }
    return (
      <code className="bg-[#09090B] px-1 py-0.5 rounded text-[#00F0FF] text-xs">
        {children}
      </code>
    );
  },
  blockquote: ({ children }: any) => (
    <blockquote className="border-l-2 border-[#00FF41]/20 pl-3 italic text-[#A0A0B0] my-2">
      {children}
    </blockquote>
  ),
};

function PostBody({ post }: { post: DiscussionPost }) {
  return (
    <div className="space-y-3">
      <div className="prose prose-invert prose-sm max-w-none text-[#D0D0D0]">
        <ReactMarkdown components={markdownComponents}>
          {post.content}
        </ReactMarkdown>
      </div>
      {post.isEdited && (
        <span className="text-[10px] text-[#A0A0B0]/60 italic">(edited)</span>
      )}
    </div>
  );
}

export function ThreadCard({
  post,
  replies,
  currentUserId,
  isAdmin,
  replyingTo,
  editingId,
  onReply,
  onEdit,
  onDelete,
  onSetReplying,
  onSetEditing,
}: ThreadCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const isOwner = post.userId === currentUserId;
  const canModify = isOwner || isAdmin;

  const handleDelete = async () => {
    if (!confirm("Delete this post and all replies?")) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await onDelete(post.id);
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Delete failed",
      );
    } finally {
      setDeleting(false);
    }
  };

  const preview = stripMarkdown(post.content).slice(0, 200);

  return (
    <div className="glass-panel animate-fade-in">
      <div
        className="p-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-6 h-6 rounded-full bg-[#00FF41]/20 border border-[#00FF41]/30 flex items-center justify-center text-[10px] text-[#00FF41] font-['Share_Tech_Mono',monospace] shrink-0">
                {post.username.charAt(0).toUpperCase()}
              </span>
              <span className="text-sm text-[#F0F0F0] font-medium truncate">
                {post.username}
              </span>
              <span className="text-xs text-[#A0A0B0]/60">
                {timeAgo(post.createdAt)}
              </span>
            </div>
            <h3 className="text-base text-[#00FF41] font-['Share_Tech_Mono',monospace] mb-1">
              {post.title || (
                <span className="text-[#A0A0B0] italic">(reply to thread)</span>
              )}
            </h3>
            {!expanded && (
              <p className="text-sm text-[#A0A0B0] line-clamp-2">
                {preview}
                {preview.length >= 200 ? "..." : ""}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-xs text-[#A0A0B0]/60 tabular-nums">
              {replies.length > 0
                ? `${replies.length} ${replies.length === 1 ? "reply" : "replies"}`
                : "No replies"}
            </span>
            <span
              className="text-[#00FF41]/50 text-sm transition-transform duration-200"
              style={{
                transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
              }}
            >
              ▶
            </span>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-[#00FF41]/5 animate-fade-in">
          <div className="pt-4">
            <PostBody post={post} />
          </div>

          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/5">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onSetReplying(replyingTo === post.id ? null : post.id);
              }}
            >
              {replyingTo === post.id ? "Cancel Reply" : "Reply"}
            </Button>
            {isOwner && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onSetEditing(editingId === post.id ? null : post.id);
                }}
              >
                {editingId === post.id ? "Cancel Edit" : "Edit"}
              </Button>
            )}
            {canModify && (
              <Button
                variant="ghost"
                size="sm"
                loading={deleting}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete();
                }}
                className="hover:text-[#FF4444]"
              >
                Delete
              </Button>
            )}
          </div>

          {deleteError && (
            <div className="p-2 rounded bg-[#FF4444]/10 border border-[#FF4444]/30 text-xs text-[#FF4444] mt-2">
              {deleteError}
            </div>
          )}

          {editingId === post.id && (
            <div className="mt-3">
              <PostForm
                mode="edit"
                initialContent={post.content}
                onSubmit={async (data) => {
                  await onEdit(post.id, data.content);
                  onSetEditing(null);
                }}
                onCancel={() => onSetEditing(null)}
              />
            </div>
          )}

          {replyingTo === post.id && (
            <div className="mt-3">
              <PostForm
                mode="reply"
                onSubmit={async (data) => {
                  await onReply(post.id, data.content);
                  onSetReplying(null);
                }}
                onCancel={() => onSetReplying(null)}
              />
            </div>
          )}

          {replies.length > 0 && (
            <div className="mt-4 ml-8 pl-4 border-l-2 border-[#00FF41]/10 space-y-3">
              {replies.map((reply) => (
                <div key={reply.id} className="animate-fade-in">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-5 h-5 rounded-full bg-[#00FF41]/10 border border-[#00FF41]/20 flex items-center justify-center text-[9px] text-[#00FF41] font-['Share_Tech_Mono',monospace] shrink-0">
                      {reply.username.charAt(0).toUpperCase()}
                    </span>
                    <span className="text-xs text-[#F0F0F0] font-medium">
                      {reply.username}
                    </span>
                    <span className="text-[10px] text-[#A0A0B0]/60">
                      {timeAgo(reply.createdAt)}
                    </span>
                  </div>
                  <PostBody post={reply} />
                  {reply.isEdited && (
                    <span className="text-[10px] text-[#A0A0B0]/60 italic">
                      (edited)
                    </span>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    {(reply.userId === currentUserId || isAdmin) && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            onSetEditing(
                              editingId === reply.id ? null : reply.id,
                            )
                          }
                        >
                          {editingId === reply.id ? "Cancel Edit" : "Edit"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            if (!confirm("Delete this reply?")) return;
                            await onDelete(reply.id);
                          }}
                          className="hover:text-[#FF4444]"
                        >
                          Delete
                        </Button>
                      </>
                    )}
                  </div>
                  {editingId === reply.id && (
                    <div className="mt-2">
                      <PostForm
                        mode="edit"
                        initialContent={reply.content}
                        onSubmit={async (data) => {
                          await onEdit(reply.id, data.content);
                          onSetEditing(null);
                        }}
                        onCancel={() => onSetEditing(null)}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
