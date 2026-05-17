"use client";

import ReactMarkdown from "react-markdown";
import { formatDistanceToNow } from "date-fns";
import { Card } from "@/components/ui/Card";
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
  thread: DiscussionPost;
  replies: DiscussionPost[];
  isExpanded: boolean;
  onToggle: () => void;
  currentUserId: string;
  isAdmin: boolean;
  replyingTo: string | null;
  editingPostId: string | null;
  onReply: (postId: string) => void;
  onEdit: (postId: string) => void;
  onDelete: (postId: string) => void;
  onSubmitReply: (data: { title?: string; content: string; parentId?: string }) => Promise<void>;
  onSubmitEdit: (postId: string, content: string) => Promise<void>;
  onCancelReply: () => void;
  onCancelEdit: () => void;
}

function stripMarkdown(md: string, maxLen = 200): string {
  const plain = md.replace(/[#*`\[\]~>_]/g, "").replace(/\n+/g, " ").trim();
  return plain.length > maxLen ? plain.slice(0, maxLen) + "…" : plain;
}

function timeAgo(dateStr: string): string {
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  } catch {
    return dateStr;
  }
}

function PostBody({
  post,
  currentUserId,
  isAdmin,
  editingPostId,
  onEdit,
  onDelete,
  onReply,
  onSubmitEdit,
  onCancelEdit,
}: {
  post: DiscussionPost;
  currentUserId: string;
  isAdmin: boolean;
  editingPostId: string | null;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onReply: (id: string) => void;
  onSubmitEdit: (postId: string, content: string) => Promise<void>;
  onCancelEdit: () => void;
}) {
  const isEditing = editingPostId === post.id;
  const isOwner = post.userId === currentUserId;

  return (
    <div className="glass-panel p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-7 h-7 rounded-full bg-[#00FF41]/20 flex items-center justify-center text-xs text-[#00FF41] font-['Share_Tech_Mono',monospace] shrink-0">
          {post.username[0].toUpperCase()}
        </div>
        <span className="text-sm text-[#F0F0F0] font-medium">{post.username}</span>
        <span className="text-xs text-[#A0A0B0]">{timeAgo(post.createdAt)}</span>
        {post.isEdited && (
          <span className="text-xs text-[#A0A0B0]/60 italic">(edited)</span>
        )}
      </div>

      {isEditing ? (
        <PostForm
          mode="edit"
          initialContent={post.content}
          onSubmit={async (data) => {
            await onSubmitEdit(post.id, data.content);
          }}
          onCancel={onCancelEdit}
        />
      ) : (
        <div className="text-sm text-[#F0F0F0] font-['Fira_Code',monospace] leading-relaxed">
          <ReactMarkdown
            components={{
              a: ({ href, children }) => (
                <a
                  href={href}
                  className="text-[#00FF41] hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {children}
                </a>
              ),
              code: ({ children }) => (
                <code className="bg-[#0F0F13] px-1.5 py-0.5 rounded text-[#00F0FF] text-xs">
                  {children}
                </code>
              ),
              blockquote: ({ children }) => (
                <blockquote className="border-l-2 border-[#00FF41]/20 pl-3 text-[#A0A0B0] italic">
                  {children}
                </blockquote>
              ),
            }}
          >
            {post.content}
          </ReactMarkdown>
        </div>
      )}

      {!isEditing && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5">
          <Button variant="ghost" size="sm" onClick={() => onReply(post.id)}>
            Reply
          </Button>
          {isOwner && (
            <>
              <Button variant="ghost" size="sm" onClick={() => onEdit(post.id)}>
                Edit
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onDelete(post.id)}>
                Delete
              </Button>
            </>
          )}
          {!isOwner && isAdmin && (
            <Button variant="danger" size="sm" onClick={() => onDelete(post.id)}>
              Delete
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function ThreadCard({
  thread,
  replies,
  isExpanded,
  onToggle,
  currentUserId,
  isAdmin,
  replyingTo,
  editingPostId,
  onReply,
  onEdit,
  onDelete,
  onSubmitReply,
  onSubmitEdit,
  onCancelReply,
  onCancelEdit,
}: ThreadCardProps) {
  return (
    <div>
      <Card hover glow="green" className="cursor-pointer" onClick={onToggle}>
        <div className="flex items-start gap-4">
          <div className="w-9 h-9 rounded-full bg-[#00FF41]/20 flex items-center justify-center text-sm text-[#00FF41] font-['Share_Tech_Mono',monospace] shrink-0 mt-0.5">
            {thread.username[0].toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-['Share_Tech_Mono',monospace] text-[#F0F0F0] text-base mb-1">
              {thread.title}
            </h3>
            <div className="flex items-center gap-3 text-xs text-[#A0A0B0] mb-2">
              <span>{thread.username}</span>
              <span>{"·"}</span>
              <span>{timeAgo(thread.createdAt)}</span>
              {replies.length > 0 && (
                <>
                  <span>{"·"}</span>
                  <span className="text-[#00FF41]">
                    {replies.length} {replies.length === 1 ? "reply" : "replies"}
                  </span>
                </>
              )}
            </div>
            <p className="text-sm text-[#A0A0B0] line-clamp-2 font-['Fira_Code',monospace]">
              {stripMarkdown(thread.content)}
            </p>
          </div>
          <span className="text-[#A0A0B0]/50 text-lg shrink-0">
            {isExpanded ? "▴" : "▾"}
          </span>
        </div>
      </Card>

      {isExpanded && (
        <div className="ml-4 mt-2 space-y-3 border-l-2 border-[#00FF41]/10 pl-4 animate-fade-in">
          <PostBody
            post={thread}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            editingPostId={editingPostId}
            onEdit={onEdit}
            onDelete={onDelete}
            onReply={onReply}
            onSubmitEdit={onSubmitEdit}
            onCancelEdit={onCancelEdit}
          />

          {replies.map((reply) => (
            <PostBody
              key={reply.id}
              post={reply}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              editingPostId={editingPostId}
              onEdit={onEdit}
              onDelete={onDelete}
              onReply={onReply}
              onSubmitEdit={onSubmitEdit}
              onCancelEdit={onCancelEdit}
            />
          ))}

          {replyingTo === thread.id && (
            <div className="glass-panel p-4">
              <PostForm
                mode="reply"
                onSubmit={onSubmitReply}
                onCancel={onCancelReply}
              />
            </div>
          )}

          {replyingTo !== thread.id && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onReply(thread.id)}
            >
              + Add reply
            </Button>
          )}
        </div>
      )}
    </div>
  );
}