import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, projectMembers, folders } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  customId: z
    .string()
    .min(4)
    .max(32)
    .regex(/^[a-zA-Z0-9_-]+$/, "Custom ID can only contain letters, numbers, hyphens, and underscores")
    .optional(),
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

  const userId = session.user.id;
  const { name, description, customId } = parsed.data;

  try {
    const project = await db.transaction(async (tx) => {
      if (customId) {
        const [existing] = await tx
          .select({ id: projects.id })
          .from(projects)
          .where(eq(projects.customId, customId))
          .limit(1);
        if (existing) {
          tx.rollback();
          return { conflict: true as const };
        }
      }

      const [newProject] = await tx
        .insert(projects)
        .values({ name, description: description ?? null, customId: customId ?? null, createdBy: userId })
        .returning();

      await tx.insert(projectMembers).values({
        projectId: newProject.id,
        userId,
        role: "admin",
      });

      const defaultFolders = ["Materials", "Demos", "Finished"];
      for (const folderName of defaultFolders) {
        await tx.insert(folders).values({
          projectId: newProject.id,
          name: folderName,
          createdBy: userId,
        });
      }

      return newProject;
    });

    if (project && "conflict" in project) {
      return NextResponse.json(
        { error: "Custom ID is already taken" },
        { status: 409 },
      );
    }

    return NextResponse.json(project, { status: 201 });
  } catch (err) {
    console.error("Failed to create project:", err);
    return NextResponse.json(
      { error: "Database error — please try again" },
      { status: 500 },
    );
  }
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

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
    .where(inArray(projects.id, projectIds))
    .orderBy(projects.createdAt);

  return NextResponse.json(projectList);
}
