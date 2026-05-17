import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { projects, projectMembers } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { CreateProjectButton } from "./CreateProjectButton";
import { JoinProjectButton } from "./JoinProjectButton";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userId = (session.user as any).id as string;

  const memberOf = await db
    .select({
      projectId: projectMembers.projectId,
      role: projectMembers.role,
    })
    .from(projectMembers)
    .where(eq(projectMembers.userId, userId));

  const projectIds = memberOf.map((m) => m.projectId);

  const projectList =
    projectIds.length > 0
      ? await db
          .select()
          .from(projects)
          .where(inArray(projects.id, projectIds))
          .orderBy(projects.createdAt)
      : [];

  return (
    <div>
      <TopBar
        title="Projects"
        subtitle={`${projectList.length} project${projectList.length !== 1 ? "s" : ""}`}
        actions={
          <div className="flex gap-2">
            <JoinProjectButton />
            <CreateProjectButton />
          </div>
        }
      />

      <div className="p-6">
        {projectList.length === 0 ? (
          <GlassPanel glow="green" className="text-center py-16">
            <div className="text-5xl mb-4">◈</div>
            <h2 className="text-xl font-['Share_Tech_Mono',monospace] neon-text mb-2">
              No Projects Yet
            </h2>
            <p className="text-[#A0A0B0] mb-6">
              Create a new project or join an existing one with an invite code.
            </p>
            <div className="flex gap-3 justify-center">
              <JoinProjectButton />
              <CreateProjectButton />
            </div>
          </GlassPanel>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projectList.map((project) => (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <Card hover glow="green" className="h-full">
                  <h3 className="font-['Share_Tech_Mono',monospace] text-[#F0F0F0] text-lg mb-1">
                    {project.name}
                  </h3>
                  {project.description && (
                    <p className="text-sm text-[#A0A0B0] line-clamp-2">
                      {project.description}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-4">
                    <span className="text-xs text-[#A0A0B0]">
                      {memberOf.find((m) => m.projectId === project.id)?.role === "admin"
                        ? "Admin"
                        : "Member"}
                    </span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
