import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { projectMembers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { TopBar } from "@/components/TopBar";
import { CreativeSpaceRoom } from "@/components/space/CreativeSpaceRoom";

export default async function SpacePage({
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

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="Creative Space"
        subtitle="Real-time audio · screen sharing · voice & video"
      />
      <CreativeSpaceRoom projectId={id} userId={userId} />
    </div>
  );
}
