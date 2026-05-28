import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { projects, projectMembers } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { Sidebar } from "@/components/Sidebar";
import { DashboardLayoutClient } from "./DashboardLayoutClient";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userId = session.user.id;

  let userProjects: { id: string; name: string; status: string }[] = [];
  try {
    const memberships = await db
      .select({ projectId: projectMembers.projectId })
      .from(projectMembers)
      .where(eq(projectMembers.userId, userId));

    if (memberships.length > 0) {
      const ids = memberships.map((m) => m.projectId);
      userProjects = await db
        .select({
          id: projects.id,
          name: projects.name,
          status: projects.status,
        })
        .from(projects)
        .where(inArray(projects.id, ids))
        .orderBy(projects.createdAt);
    }
  } catch {
    // If DB is unavailable, sidebar shows no project links
  }

  return (
    <div className="min-h-screen bg-[#09090B]">
      <Sidebar username={session.user?.username ?? undefined} projects={userProjects} />
      <DashboardLayoutClient>{children}</DashboardLayoutClient>
    </div>
  );
}
