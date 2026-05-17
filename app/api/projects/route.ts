import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, projectMembers, folders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const userId = (session.user as any).id as string;
  const { name, description } = parsed.data;

  const [project] = await db
    .insert(projects)
    .values({ name, description: description ?? null, createdBy: userId })
    .returning();

  await db.insert(projectMembers).values({
    projectId: project.id,
    userId,
    role: "admin",
  });

  const defaultFolders = ["Materials", "Demos", "Finished"];
  for (const folderName of defaultFolders) {
    await db.insert(folders).values({
      projectId: project.id,
      name: folderName,
      createdBy: userId,
    });
  }

  return NextResponse.json(project, { status: 201 });
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any).id as string;

  const memberships = await db
    .select({ projectId: projectMembers.projectId })
    .from(projectMembers)
    .where(eq(projectMembers.userId, userId));

  if (memberships.length === 0) {
    return NextResponse.json([]);
  }

  const projectIds = memberships.map((m) => m.projectId);
  const projectList = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectIds[0]))
    .orderBy(projects.createdAt);

  return NextResponse.json(projectList);
}
