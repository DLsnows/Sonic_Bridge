import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { projectMembers, folders } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { TopBar } from "@/components/TopBar";
import { FileBrowser } from "@/components/files/FileBrowser";

export default async function FilesPage({
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

  const folderList = await db
    .select()
    .from(folders)
    .where(eq(folders.projectId, id))
    .orderBy(folders.createdAt);

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Project Files" subtitle="Upload, download & manage project assets" />
      <FileBrowser projectId={id} userId={userId} initialFolders={folderList} />
    </div>
  );
}