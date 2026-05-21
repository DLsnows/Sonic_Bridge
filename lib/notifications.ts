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

  for (const userId of memberIds) {
    await db.insert(notifications).values({
      userId,
      projectId,
      type,
      referenceId,
      referenceType,
    });
  }

  if (type === "new_reply" && parentUserId && parentUserId !== actorUserId && !memberIds.includes(parentUserId)) {
    await db.insert(notifications).values({
      userId: parentUserId,
      projectId,
      type: "reply_to_user",
      referenceId,
      referenceType,
    });
  }
}
