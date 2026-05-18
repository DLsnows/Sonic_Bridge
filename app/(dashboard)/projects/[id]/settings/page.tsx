import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { projects, projectMembers, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { TopBar } from "@/components/TopBar";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { CopyProjectId } from "./CopyProjectId";
import { GenerateToken } from "./GenerateToken";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const userId = (session.user as any).id as string;

  const [membership] = await db
    .select()
    .from(projectMembers)
    .where(
      and(eq(projectMembers.projectId, id), eq(projectMembers.userId, userId)),
    )
    .limit(1);

  if (!membership || membership.role !== "admin") redirect(`/projects/${id}`);

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);

  if (!project) redirect("/");

  return (
    <div>
      <TopBar title="Project Settings" showBack />
      <div className="p-6 max-w-2xl space-y-6">
        <GlassPanel>
          <h3 className="font-['Share_Tech_Mono',monospace] text-sm text-[#00FF41] mb-4">
            General
          </h3>
          <CopyProjectId projectId={project.id} />
        </GlassPanel>

        <GlassPanel>
          <h3 className="font-['Share_Tech_Mono',monospace] text-sm text-[#00FF41] mb-4">
            API Access
          </h3>
          <p className="text-sm text-[#A0A0B0] mb-4">
            Generate an API token for automated file management via AI agents or scripts.
          </p>
          <GenerateToken />
        </GlassPanel>
      </div>
    </div>
  );
}
