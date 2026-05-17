import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { projects, projectMembers, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { TopBar } from "@/components/TopBar";
import { Card } from "@/components/ui/Card";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { Button } from "@/components/ui/Button";

const navCards = [
  {
    href: "space",
    label: "Creative Space",
    desc: "Real-time audio, screen sharing, voice & video",
    icon: "◈",
    glow: "green" as const,
  },
  {
    href: "files",
    label: "Project Files",
    desc: "Upload, download & manage project assets",
    icon: "◫",
    glow: "cyan" as const,
  },
  {
    href: "schedule",
    label: "Schedule",
    desc: "Meetings, production cycles, release dates",
    icon: "◷",
    glow: "purple" as const,
  },
  {
    href: "discussion",
    label: "Discussion",
    desc: "Ideas, feedback & team conversations",
    icon: "☰",
    glow: "green" as const,
  },
];

export default async function ProjectPage({
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

  if (!membership) redirect("/");

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);

  if (!project) redirect("/");

  const members = await db
    .select({
      userId: projectMembers.userId,
      username: users.username,
      role: projectMembers.role,
    })
    .from(projectMembers)
    .innerJoin(users, eq(projectMembers.userId, users.id))
    .where(eq(projectMembers.projectId, id));

  const isAdmin = membership.role === "admin";

  return (
    <div>
      <TopBar
        title={project.name}
        subtitle={project.description ?? undefined}
        actions={
          isAdmin ? (
            <Button variant="secondary" size="sm">
              Project Settings
            </Button>
          ) : undefined
        }
      />

      <div className="p-6">
        {/* Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {navCards.map((card) => (
            <Link key={card.href} href={`/projects/${id}/${card.href}`}>
              <Card hover glow={card.glow} className="h-full group">
                <div className="flex items-start gap-4">
                  <span className="text-2xl mt-1">{card.icon}</span>
                  <div>
                    <h3 className="font-['Share_Tech_Mono',monospace] text-[#F0F0F0] text-lg mb-1">
                      {card.label}
                    </h3>
                    <p className="text-sm text-[#A0A0B0]">{card.desc}</p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>

        {/* Project Info & Members */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <GlassPanel>
            <h3 className="font-['Share_Tech_Mono',monospace] text-sm text-[#00FF41] mb-4">
              Project Info
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[#A0A0B0]">Project ID</span>
                <span className="text-[#F0F0F0] font-mono text-xs">
                  {project.id}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#A0A0B0]">Created</span>
                <span className="text-[#F0F0F0]">
                  {project.createdAt?.toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#A0A0B0]">My Role</span>
                <span className="text-[#00FF41]">{isAdmin ? "Admin" : "Member"}</span>
              </div>
            </div>
          </GlassPanel>

          <GlassPanel>
            <h3 className="font-['Share_Tech_Mono',monospace] text-sm text-[#00FF41] mb-4">
              Members ({members.length})
            </h3>
            <div className="space-y-2">
              {members.map((member) => (
                <div
                  key={member.userId}
                  className="flex items-center justify-between py-1"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-[#00FF41]/20 flex items-center justify-center text-xs text-[#00FF41] font-['Share_Tech_Mono',monospace]">
                      {member.username[0].toUpperCase()}
                    </div>
                    <span className="text-sm text-[#F0F0F0]">
                      {member.username}
                    </span>
                  </div>
                  <span className="text-xs text-[#A0A0B0]">
                    {member.role === "admin" ? "Admin" : "Member"}
                  </span>
                </div>
              ))}
            </div>
          </GlassPanel>
        </div>
      </div>
    </div>
  );
}
