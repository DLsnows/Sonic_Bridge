import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projectAiConfigs, projectMembers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { encrypt } from "@/lib/encryption";

const putSchema = z.object({
  apiUrl: z.string().min(1, "API URL is required"),
  apiKey: z.string().optional(),
  model: z.string().min(1).default("gpt-4o-mini"),
});

async function requireAdmin(projectId: string, userId: string) {
  const [membership] = await db
    .select()
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, userId),
      ),
    )
    .limit(1);

  if (!membership) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }
  if (membership.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId } = await params;
  const userId = (session.user as any).id as string;

  const error = await requireAdmin(projectId, userId);
  if (error) return error;

  const [config] = await db
    .select()
    .from(projectAiConfigs)
    .where(eq(projectAiConfigs.projectId, projectId))
    .limit(1);

  if (!config) {
    return NextResponse.json({ configured: false });
  }

  return NextResponse.json({
    configured: true,
    apiUrl: config.apiUrl,
    model: config.model,
    hasKey: true,
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId } = await params;
  const userId = (session.user as any).id as string;

  const error = await requireAdmin(projectId, userId);
  if (error) return error;

  const parsed = putSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { apiUrl, apiKey, model } = parsed.data;

  const [existing] = await db
    .select()
    .from(projectAiConfigs)
    .where(eq(projectAiConfigs.projectId, projectId))
    .limit(1);

  let encryptedApiKey: string;

  if (apiKey && apiKey.trim().length > 0) {
    encryptedApiKey = encrypt(apiKey.trim());
  } else if (existing) {
    encryptedApiKey = existing.encryptedApiKey;
  } else {
    return NextResponse.json(
      { error: "API key is required" },
      { status: 400 },
    );
  }

  if (existing) {
    await db
      .update(projectAiConfigs)
      .set({
        apiUrl,
        encryptedApiKey,
        model,
        updatedAt: new Date(),
      })
      .where(eq(projectAiConfigs.id, existing.id));
  } else {
    await db.insert(projectAiConfigs).values({
      projectId,
      apiUrl,
      encryptedApiKey,
      model,
      createdBy: userId,
    });
  }

  return NextResponse.json({
    configured: true,
    apiUrl,
    model,
    hasKey: true,
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId } = await params;
  const userId = (session.user as any).id as string;

  const error = await requireAdmin(projectId, userId);
  if (error) return error;

  await db
    .delete(projectAiConfigs)
    .where(eq(projectAiConfigs.projectId, projectId));

  return NextResponse.json({ configured: false });
}
