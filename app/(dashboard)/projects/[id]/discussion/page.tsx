import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { discussionPosts, projectMembers, projects, users } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { resolveProjectId } from "@/lib/project-utils";
import { DiscussionBoard } from "@/components/discussion";

export default async function DiscussionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const projectId = await resolveProjectId(id);
  if (!projectId) redirect("/projects");

  const userId = session.user.id;

  const [membership] = await db
    .select()
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, userId),
      ),
    )
    .limit(1);

  if (!membership) redirect("/projects");

  const [project] = await db
    .select({ name: projects.name })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  const posts = await db
    .select({
      id: discussionPosts.id,
      projectId: discussionPosts.projectId,
      userId: discussionPosts.userId,
      username: users.username,
      avatar: users.avatar,
      title: discussionPosts.title,
      content: discussionPosts.content,
      parentId: discussionPosts.parentId,
      isEdited: discussionPosts.isEdited,
      isAiGenerated: discussionPosts.isAiGenerated,
      createdAt: discussionPosts.createdAt,
      updatedAt: discussionPosts.updatedAt,
    })
    .from(discussionPosts)
    .innerJoin(users, eq(discussionPosts.userId, users.id))
    .where(eq(discussionPosts.projectId, projectId))
    .orderBy(desc(discussionPosts.createdAt));

  return (
    <DiscussionBoard
      projectId={projectId}
      projectName={project?.name ?? "Project"}
      initialPosts={posts.map((p) => ({
        ...p,
        isEdited: p.isEdited ?? false,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      }))}
      currentUserId={userId}
      isAdmin={membership.role === "admin"}
      backHref={`/projects/${projectId}`}
    />
  );
}
