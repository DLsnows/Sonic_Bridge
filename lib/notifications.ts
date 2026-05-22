import { db } from "@/lib/db";
import { notifications, projectMembers, discussionPosts } from "@/lib/db/schema";
import { eq, and, ne, inArray } from "drizzle-orm";

/**
 * Creates targeted reply_to_user notifications for all thread participants.
 * Generic activity notifications (new_post, new_file, new_event) are covered
 * by the unified GET /api/notifications query reading source tables directly.
 */
export async function createReplyNotifications(params: {
  referenceId: string;
  projectId: string;
  actorUserId: string;
  parentId: string;
}) {
  const { referenceId, projectId, actorUserId, parentId } = params;

  // Check if the reply is AI-generated — if so, skip notifications
  const [post] = await db
    .select({ isAiGenerated: discussionPosts.isAiGenerated })
    .from(discussionPosts)
    .where(eq(discussionPosts.id, referenceId))
    .limit(1);
  if (!post || post.isAiGenerated) return;

  // Walk up to find the thread root, then walk down to find all participants
  const participantIds = await findThreadParticipantIds(parentId, projectId);
  participantIds.delete(actorUserId);
  if (participantIds.size === 0) return;

  // Verify each user is still a project member
  const memberRows = await db
    .select({ userId: projectMembers.userId })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        inArray(projectMembers.userId, [...participantIds]),
      ),
    );
  const validUserIds = new Set(memberRows.map((r) => r.userId));

  const rows = [...validUserIds].map((userId) => ({
    userId,
    projectId,
    type: "reply_to_user" as const,
    referenceId,
    referenceType: "discussion_post" as const,
  }));

  if (rows.length > 0) {
    await db.insert(notifications).values(rows);
  }
}

/** Walk up to root, then walk down all branches to collect every participant in the thread. */
async function findThreadParticipantIds(
  parentId: string,
  projectId: string,
): Promise<Set<string>> {
  const userIds = new Set<string>();
  const allPostIds = new Set<string>();
  const visited = new Set<string>();

  // Phase 1: walk up to root, collecting all post IDs and userIds along the path
  let current: string | null = parentId;
  while (current && !visited.has(current)) {
    visited.add(current);
    const [row] = await db
      .select({
        userId: discussionPosts.userId,
        parentId: discussionPosts.parentId,
        isAiGenerated: discussionPosts.isAiGenerated,
      })
      .from(discussionPosts)
      .where(
        and(
          eq(discussionPosts.id, current),
          eq(discussionPosts.projectId, projectId),
        ),
      )
      .limit(1);
    if (!row) break;
    allPostIds.add(current);
    if (!row.isAiGenerated) {
      userIds.add(row.userId);
    }
    current = row.parentId;
  }

  // Phase 2: walk down from all collected post IDs to find all descendants
  // (handles multi-branch threads where siblings also replied)
  const frontier = [...allPostIds];
  let depth = 0;
  while (frontier.length > 0 && depth < 100) {
    depth++;
    const children = await db
      .select({
        id: discussionPosts.id,
        userId: discussionPosts.userId,
      })
      .from(discussionPosts)
      .where(
        and(
          eq(discussionPosts.projectId, projectId),
          inArray(discussionPosts.parentId, frontier),
          ne(discussionPosts.isAiGenerated, true),
        ),
      );

    frontier.length = 0;
    for (const child of children) {
      if (!allPostIds.has(child.id)) {
        allPostIds.add(child.id);
        userIds.add(child.userId);
        frontier.push(child.id);
      }
    }
  }

  if (depth >= 100) {
    console.warn("findThreadParticipantIds: depth cap reached for project", projectId);
  }

  return userIds;
}
