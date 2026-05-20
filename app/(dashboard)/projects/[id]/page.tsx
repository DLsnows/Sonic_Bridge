import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { projects, projectMembers, users, scheduleEvents, files, discussionPosts } from "@/lib/db/schema";
import { eq, and, gte, desc, asc, isNull } from "drizzle-orm";
import { TopBar } from "@/components/TopBar";
import { ProjectIdBadge } from "@/components/ProjectIdBadge";
import { Card } from "@/components/ui/Card";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { Button } from "@/components/ui/Button";
import { resolveProjectId, projectHref } from "@/lib/project-utils";
import { ProjectStatusBadge } from "@/components/ProjectStatusBadge";
import { MemberAvatar } from "@/components/MemberAvatar";

const navCards = [
  {
    href: "space",
    label: "Creative Space",
    desc: "Real-time audio, screen sharing, voice & video",
    icon: "◈",
    glow: "cyan" as const,
  },
  {
    href: "files",
    label: "Project Files",
    desc: "Upload, download & manage project assets",
    icon: "◫",
    glow: "green" as const,
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
    glow: "orange" as const,
  },
];

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id: idParam } = await params;
  const id = await resolveProjectId(idParam);
  if (!id) redirect("/");
  const userId = session.user.id;

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
      avatar: users.avatar,
      role: projectMembers.role,
    })
    .from(projectMembers)
    .innerJoin(users, eq(projectMembers.userId, users.id))
    .where(eq(projectMembers.projectId, id));

  const isAdmin = membership.role === "admin";

  // Recent activity data
  const now = new Date();
  const upcomingEvents = await db
    .select()
    .from(scheduleEvents)
    .where(and(eq(scheduleEvents.projectId, id), gte(scheduleEvents.startTime, now)))
    .orderBy(asc(scheduleEvents.startTime))
    .limit(5);

  const recentFiles = await db
    .select()
    .from(files)
    .where(eq(files.projectId, id))
    .orderBy(desc(files.uploadedAt))
    .limit(5);

  const recentThreads = await db
    .select({
      id: discussionPosts.id,
      title: discussionPosts.title,
      username: users.username,
      createdAt: discussionPosts.createdAt,
    })
    .from(discussionPosts)
    .innerJoin(users, eq(discussionPosts.userId, users.id))
    .where(and(eq(discussionPosts.projectId, id), isNull(discussionPosts.parentId)))
    .orderBy(desc(discussionPosts.createdAt))
    .limit(5);

  return (
    <div>
      <TopBar
        title={project.name}
        subtitle={project.description ?? undefined}
        showBack
        backHref="/"
        badge={
          <div className="flex items-center gap-2">
            <ProjectIdBadge projectId={project.id} />
            <ProjectStatusBadge status={project.status ?? "in_progress"} isAdmin={isAdmin} projectId={project.id} />
          </div>
        }
        actions={
          isAdmin ? (
            <Link href={`/projects/${project.customId || project.id}/settings`}>
              <Button variant="secondary" size="sm">
                Project Settings
              </Button>
            </Link>
          ) : undefined
        }
      />

      <div className="p-6">
        {/* Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {navCards.map((card) => (
            <Link key={card.href} href={`/projects/${project.customId || project.id}/${card.href}`}>
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

        {/* Recent Activity & Members */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <GlassPanel>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-['Share_Tech_Mono',monospace] text-sm text-[#00FF41]">
                Recent Activity
              </h3>
            </div>

            <div className="space-y-4">
              {/* Upcoming Events */}
              <div>
                <h4 className="font-['Share_Tech_Mono',monospace] text-[10px] text-[#B44DFF] uppercase tracking-wider mb-2">
                  Upcoming Events
                </h4>
                {upcomingEvents.length === 0 ? (
                  <p className="text-[10px] text-[#A0A0B0]">No upcoming events</p>
                ) : (
                  <div className="space-y-1.5">
                    {upcomingEvents.map((evt) => (
                      <div key={evt.id} className="flex items-center justify-between text-xs">
                        <span className="text-[#F0F0F0] truncate max-w-[180px]">{evt.title}</span>
                        <span className="text-[#A0A0B0] font-mono text-[10px] shrink-0 ml-2">
                          {evt.startTime.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Files */}
              <div>
                <h4 className="font-['Share_Tech_Mono',monospace] text-[10px] text-[#00FF41] uppercase tracking-wider mb-2">
                  Recent Files
                </h4>
                {recentFiles.length === 0 ? (
                  <p className="text-[10px] text-[#A0A0B0]">No files uploaded</p>
                ) : (
                  <div className="space-y-1.5">
                    {recentFiles.map((f) => (
                      <div key={f.id} className="flex items-center justify-between text-xs">
                        <span className="text-[#F0F0F0] truncate max-w-[180px]">{f.name}</span>
                        <span className="text-[#A0A0B0] font-mono text-[10px] shrink-0 ml-2">
                          {(f.size / 1024).toFixed(0)} KB
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Discussions */}
              <div>
                <h4 className="font-['Share_Tech_Mono',monospace] text-[10px] text-[#FF8C00] uppercase tracking-wider mb-2">
                  Recent Discussions
                </h4>
                {recentThreads.length === 0 ? (
                  <p className="text-[10px] text-[#A0A0B0]">No discussions yet</p>
                ) : (
                  <div className="space-y-1.5">
                    {recentThreads.map((post) => (
                      <div key={post.id} className="flex items-center justify-between text-xs">
                        <span className="text-[#F0F0F0] truncate max-w-[180px]">{post.title}</span>
                        <span className="text-[#A0A0B0] text-[10px] shrink-0 ml-2">
                          {post.username}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
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
                    {member.avatar ? (
                      <MemberAvatar
                        userId={member.userId}
                        username={member.username}
                        className="w-7 h-7 rounded-full object-cover border border-[#00FF41]/20 shrink-0"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-[#00FF41]/20 flex items-center justify-center text-xs text-[#00FF41] font-['Share_Tech_Mono',monospace]">
                        {member.username[0].toUpperCase()}
                      </div>
                    )}
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
