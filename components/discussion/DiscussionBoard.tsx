"use client";

import { useState, useCallback, useMemo } from "react";
import { TopBar } from "@/components/TopBar";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { PostForm } from "./PostForm";
import { ThreadCard } from "./ThreadCard";

interface DiscussionPost {
  id: string;
  projectId: string;
  userId: string;
  username: string;
  avatar?: string | null;
  title: string;
  content: string;
  parentId: string | null;
  isEdited: boolean;
  isAiGenerated?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface DiscussionBoardProps {
  projectId: string;
  projectName: string;
  initialPosts: DiscussionPost[];
  currentUserId: string;
  isAdmin: boolean;
  backHref?: string;
}

function collectDescendantIds(
  postId: string,
  parentMap: Map<string, string[]>,
): string[] {
  const result: string[] = [];
  const queue = [postId];
  const visited = new Set<string>();
  while (queue.length > 0) {
    const id = queue.shift()!;
    const children = parentMap.get(id) ?? [];
    for (const childId of children) {
      if (!visited.has(childId)) {
        visited.add(childId);
        result.push(childId);
        queue.push(childId);
      }
    }
  }
  return result;
}

export function DiscussionBoard({
  projectId,
  projectName,
  initialPosts,
  currentUserId,
  isAdmin,
  backHref,
}: DiscussionBoardProps) {
  const [posts, setPosts] = useState<DiscussionPost[]>(initialPosts);
  const [showNewThread, setShowNewThread] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const threads = useMemo(
    () => posts.filter((p) => !p.parentId),
    [posts],
  );

  const repliesMap = useMemo(() => {
    const map = new Map<string, DiscussionPost[]>();
    for (const p of posts) {
      if (p.parentId) {
        const existing = map.get(p.parentId) ?? [];
        existing.push(p);
        map.set(p.parentId, existing);
      }
    }
    return map;
  }, [posts]);

  const parentMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const p of posts) {
      if (p.parentId) {
        const children = map.get(p.parentId) ?? [];
        children.push(p.id);
        map.set(p.parentId, children);
      }
    }
    return map;
  }, [posts]);

  const handleCreateThread = useCallback(
    async (data: { title: string; content: string }) => {
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
        const err = await res.json().catch(() => ({ error: "Failed" }));
        throw new Error(err.error ?? "Failed to create thread");
      }
      const newPost: DiscussionPost = await res.json();
      setPosts((prev) => [newPost, ...prev]);
      setShowNewThread(false);
    },
    [projectId],
  );

  const handleReply = useCallback(
    async (parentId: string, content: string) => {
      const res = await fetch(`/api/projects/${projectId}/discussion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hasParent: true, parentId, content }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed" }));
        throw new Error(err.error ?? "Failed to reply");
      }
      const newPost: DiscussionPost = await res.json();
      setPosts((prev) => [newPost, ...prev]);
    },
    [projectId],
  );

  const handleEdit = useCallback(
    async (postId: string, content: string) => {
      const res = await fetch(
        `/api/projects/${projectId}/discussion/${postId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed" }));
        throw new Error(err.error ?? "Failed to edit");
      }
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, content, isEdited: true } : p,
        ),
      );
    },
    [projectId],
  );

  const handleDelete = useCallback(
    async (postId: string) => {
      const res = await fetch(
        `/api/projects/${projectId}/discussion/${postId}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed" }));
        throw new Error(err.error ?? "Failed to delete");
      }
      const idsToRemove = new Set([
        postId,
        ...collectDescendantIds(postId, parentMap),
      ]);
      setPosts((prev) => prev.filter((p) => !idsToRemove.has(p.id)));
    },
    [projectId, parentMap],
  );

  const handleAiFormat = useCallback(
    async (postId: string) => {
      const res = await fetch(`/api/projects/${projectId}/ai-format`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed" }));
        throw new Error(err.error ?? "AI formatting failed");
      }
      const reply: DiscussionPost = await res.json();
      setPosts((prev) => [reply, ...prev]);
    },
    [projectId],
  );

  return (
    <div>
      <TopBar
        title="Discussion"
        subtitle={projectName}
        showBack
        backHref={backHref}
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowNewThread(true)}
          >
            + New Thread
          </Button>
        }
      />

      <div className="p-6 max-w-3xl mx-auto">
        {threads.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">&#9776;</div>
            <h2 className="font-['Share_Tech_Mono',monospace] text-[#FF8C00] text-xl mb-2">
              No discussions yet
            </h2>
            <p className="text-[#A0A0B0] mb-6">
              Start the first conversation in this project.
            </p>
            <Button variant="primary" onClick={() => setShowNewThread(true)}>
              Create Thread
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {threads.map((thread) => (
              <ThreadCard
                key={thread.id}
                post={thread}
                replies={repliesMap.get(thread.id) ?? []}
                currentUserId={currentUserId}
                isAdmin={isAdmin}
                projectId={projectId}
                replyingTo={replyingTo}
                editingId={editingId}
                onReply={handleReply}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onAiFormat={handleAiFormat}
                onSetReplying={setReplyingTo}
                onSetEditing={setEditingId}
              />
            ))}
          </div>
        )}
      </div>

      <Modal
        open={showNewThread}
        onClose={() => setShowNewThread(false)}
        title="New Thread"
      >
        <PostForm
          mode="thread"
          onSubmit={handleCreateThread}
          onCancel={() => setShowNewThread(false)}
        />
      </Modal>
    </div>
  );
}
