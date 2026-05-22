import { db } from "@/lib/db";
import { notifications, projectMembers, discussionPosts } from "@/lib/db/schema";
import { eq, and, ne, isNull, inArray } from "drizzle-orm";

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

  // Gather all distinct participants in this thread:
  // the root ancestor, the direct parent, and everyone who has already replied.
  const participants = await db
    .selectDistinct({ userId: discussionPosts.userId })
    .from(discussionPosts)
    .where(
      and(
        eq(discussionPosts.projectId, projectId),
        ne(discussionPosts.isAiGenerated, true),
      ),
    );

  // Walk to root to find the thread ancestor
  const ancestorIds = await findThreadAncestorIds(parentId, projectId);

  // Combine: direct participants + ancestors
  const allUserIds = new Set<string>();
  for (const p of participants) allUserIds.add(p.userId);
  for (const id of ancestorIds) allUserIds.add(id);
  allUserIds.delete(actorUserId);

  if (allUserIds.size === 0) return;

  // Verify each user is still a project member
  const memberRows = await db
    .select({ userId: projectMembers.userId })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        inArray(projectMembers.userId, [...allUserIds]),
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

/** Walk parent chain to root to find all ancestors in a thread. */
async function findThreadAncestorIds(
  parentId: string,
  projectId: string,
): Promise<string[]> {
  const ids: string[] = [];
  let current: string | null = parentId;
  const visited = new Set<string>();
  while (current && !visited.has(current)) {
    visited.add(current);
    const [row] = await db
      .select({
        userId: discussionPosts.userId,
        parentId: discussionPosts.parentId,
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
    ids.push(row.userId);
    current = row.parentId;
  }
  return ids;
}
