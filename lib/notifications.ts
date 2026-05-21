import { db } from "@/lib/db";
import { notifications, projectMembers, discussionPosts } from "@/lib/db/schema";
import { eq, and, ne } from "drizzle-orm";

type NotificationType = "new_post" | "new_reply" | "reply_to_user" | "new_event" | "new_file";

export async function createNotifications(params: {
  type: NotificationType;
  referenceId: string;
  referenceType: "discussion_post" | "schedule_event" | "file";
  projectId: string;
  actorUserId: string;
  parentUserId?: string;
}) {
  const { type, referenceId, referenceType, projectId, actorUserId, parentUserId } = params;

  if (referenceType === "discussion_post") {
    const [post] = await db
      .select({ isAiGenerated: discussionPosts.isAiGenerated })
      .from(discussionPosts)
      .where(eq(discussionPosts.id, referenceId))
      .limit(1);
    if (post?.isAiGenerated) return;
  }

  const members = await db
    .select({ userId: projectMembers.userId })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        ne(projectMembers.userId, actorUserId),
      ),
    );

  const memberIds = members.map((m) => m.userId);

  // For new_reply: exclude parent author from generic batch; they get reply_to_user instead
  const excludeUserId = type === "new_reply" ? parentUserId : null;
  const rows: Array<{
    userId: string; projectId: string; type: string; referenceId: string; referenceType: string
  }> = memberIds
    .filter((userId) => userId !== excludeUserId)
    .map((userId) => ({
      userId,
      projectId,
      type,
      referenceId,
      referenceType,
    }));

  if (type === "new_reply" && parentUserId && parentUserId !== actorUserId) {
    const [isMember] = await db
      .select({ id: projectMembers.userId })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, parentUserId)))
      .limit(1);
    if (isMember) {
      rows.push({
        userId: parentUserId,
        projectId,
        type: "reply_to_user",
        referenceId,
        referenceType,
      });
    }
  }

  if (rows.length > 0) {
    await db.insert(notifications).values(rows);
  }
}
