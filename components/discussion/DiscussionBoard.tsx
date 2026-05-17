"use client";

import { useState } from "react";
import { TopBar } from "@/components/TopBar";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { PostForm } from "./PostForm";
import { ThreadCard } from "./ThreadCard";

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

interface DiscussionBoardProps {
  projectId: string;
  projectName: string;
  initialPosts: DiscussionPost[];
  currentUserId: string;
  isAdmin: boolean;
}

export function DiscussionBoard({
  projectId,
  projectName,
  initialPosts,
  currentUserId,
  isAdmin,
}: DiscussionBoardProps) {
  const [posts, setPosts] = useState<DiscussionPost[]>(initialPosts);
  const [newThreadOpen, setNewThreadOpen] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());

  const threads = posts.filter((p) => p.parentId === null);
  const repliesByParent = new Map<string, DiscussionPost[]>();
  for (const p of posts) {
    if (p.parentId) {
      const list = repliesByParent.get(p.parentId) ?? [];
      list.push(p);
      repliesByParent.set(p.parentId, list);
    }
  }

  function toggleThread(threadId: string) {
    setExpandedThreads((prev) => {
      const next = new Set(prev);
      if (next.has(threadId)) {
        next.delete(threadId);
      } else {
        next.add(threadId);
      }
      return next;
    });
  }

  async function handleCreateThread(data: {
    title?: string;
    content: string;
    parentId?: string;
  }) {
    const res = await fetch(`/api/projects/${projectId}/discussion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hasParent: false,
        title: data.title,
        content: data.content,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? "Failed to create thread");
    }

    const newPost: DiscussionPost = await res.json();
    setPosts((prev) => [newPost, ...prev]);
    setNewThreadOpen(false);
    setExpandedThreads((prev) => new Set(prev).add(newPost.id));
  }

  async function handleReply(data: {
    title?: string;
    content: string;
    parentId?: string;
  }) {
    const parentId = replyingTo;
    if (!parentId) return;

    const res = await fetch(`/api/projects/${projectId}/discussion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hasParent: true,
        parentId,
        content: data.content,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? "Failed to post reply");
    }

    const newPost: DiscussionPost = await res.json();
    setPosts((prev) => [...prev, newPost]);
    setReplyingTo(null);
  }

  async function handleEdit(postId: string, content: string) {
    const res = await fetch(
      `/api/projects/${projectId}/discussion/${postId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      },
    );

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? "Failed to edit post");
    }

    const updated: DiscussionPost = await res.json();
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? updated : p)),
    );
    setEditingPostId(null);
  }

  async function handleDelete(postId: string) {
    const res = await fetch(
      `/api/projects/${projectId}/discussion/${postId}`,
      { method: "DELETE" },
    );

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? "Failed to delete post");
    }

    const { deleted } = await res.json();
    const idsToRemove = new Set([postId]);

    if (deleted > 1) {
      const parentMap = new Map<string, string[]>();
      for (const p of posts) {
        if (p.parentId) {
          const children = parentMap.get(p.parentId) ?? [];
          children.push(p.id);
          parentMap.set(p.parentId, children);
        }
      }
      const stack = [...(parentMap.get(postId) ?? [])];
      while (stack.length > 0) {
        const id = stack.pop()!;
        idsToRemove.add(id);
        const children = parentMap.get(id) ?? [];
        stack.push(...children);
      }
    }

    setPosts((prev) => prev.filter((p) => !idsToRemove.has(p.id)));

    if (editingPostId && idsToRemove.has(editingPostId)) {
      setEditingPostId(null);
    }
    if (replyingTo && idsToRemove.has(replyingTo)) {
      setReplyingTo(null);
    }
  }

  return (
    <div>
      <TopBar
        title="Discussion"
        subtitle={`${projectName} · ${threads.length} ${threads.length === 1 ? "thread" : "threads"}`}
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={() => setNewThreadOpen(true)}
          >
            + New Thread
          </Button>
        }
      />

      <div className="p-6 max-w-4xl mx-auto space-y-4">
        {threads.length === 0 ? (
          <GlassPanel className="text-center py-16">
            <div className="text-5xl mb-4">☰</div>
            <h2 className="font-['Share_Tech_Mono',monospace] neon-text text-xl mb-2">
              Discussion
            </h2>
            <p className="text-[#A0A0B0] mb-4">
              No discussions yet. Start the first thread!
            </p>
            <Button
              variant="primary"
              size="md"
              onClick={() => setNewThreadOpen(true)}
            >
              + New Thread
            </Button>
          </GlassPanel>
        ) : (
          threads.map((thread) => (
            <ThreadCard
              key={thread.id}
              thread={thread}
              replies={repliesByParent.get(thread.id) ?? []}
              isExpanded={expandedThreads.has(thread.id)}
              onToggle={() => toggleThread(thread.id)}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              replyingTo={replyingTo}
              editingPostId={editingPostId}
              onReply={setReplyingTo}
              onEdit={setEditingPostId}
              onDelete={handleDelete}
              onSubmitReply={handleReply}
              onSubmitEdit={handleEdit}
              onCancelReply={() => setReplyingTo(null)}
              onCancelEdit={() => setEditingPostId(null)}
            />
          ))
        )}
      </div>

      <Modal
        open={newThreadOpen}
        onClose={() => setNewThreadOpen(false)}
        title="New Thread"
      >
        <PostForm
          mode="thread"
          onSubmit={handleCreateThread}
          onCancel={() => setNewThreadOpen(false)}
        />
      </Modal>
    </div>
  );
}