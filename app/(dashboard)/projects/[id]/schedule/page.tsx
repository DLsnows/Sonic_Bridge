import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { projectMembers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { ScheduleView } from "./ScheduleView";

export default async function SchedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const userId = session.user.id;

  const [membership] = await db
    .select()
    .from(projectMembers)
    .where(
      and(eq(projectMembers.projectId, id), eq(projectMembers.userId, userId)),
    )
    .limit(1);

  if (!membership) redirect("/");

  return (
    <ScheduleView
      projectId={id}
      userId={userId}
      userRole={membership.role}
      backHref={`/projects/${id}`}
    />
  );
}
