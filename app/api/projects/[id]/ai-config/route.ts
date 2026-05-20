import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projectAiConfigs, projectMembers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { encrypt } from "@/lib/encryption";

async function requireAdmin(projectId: string) {
  const session = await auth();
  if (!session?.user) return null;

  const [membership] = await db
    .select()
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, session.user.id),
      ),
    )
    .limit(1);

  if (!membership || membership.role !== "admin") return null;
  return session;
}

const putSchema = z.object({
  apiUrl: z.string().url().or(z.string().min(1)),
  apiKey: z.string().min(1).optional(),
  model: z.string().min(1).default("gpt-4o-mini"),
});

// GET — return current AI config (never the actual key)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdmin((await params).id);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId } = await params;

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

// PUT — create or update AI config
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdmin((await params).id);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId } = await params;
  const parsed = putSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { apiUrl, apiKey, model } = parsed.data;

  const [existing] = await db
    .select()
    .from(projectAiConfigs)
    .where(eq(projectAiConfigs.projectId, projectId))
    .limit(1);

  let encryptedApiKey: string;
  if (apiKey) {
    encryptedApiKey = encrypt(apiKey);
  } else if (existing) {
    encryptedApiKey = existing.encryptedApiKey;
  } else {
    return NextResponse.json(
      { error: "API key is required for initial setup" },
      { status: 400 },
    );
  }

  if (existing) {
    const [updated] = await db
      .update(projectAiConfigs)
      .set({
        apiUrl,
        encryptedApiKey,
        model,
        updatedAt: new Date(),
      })
      .where(eq(projectAiConfigs.id, existing.id))
      .returning();
    return NextResponse.json({
      configured: true,
      apiUrl: updated.apiUrl,
      model: updated.model,
      hasKey: true,
    });
  }

  await db.insert(projectAiConfigs).values({
    projectId,
    apiUrl,
    encryptedApiKey,
    model,
    createdBy: session.user.id,
  });

  return NextResponse.json(
    { configured: true, apiUrl, model, hasKey: true },
    { status: 201 },
  );
}

// DELETE — remove AI config
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdmin((await params).id);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId } = await params;

  await db
    .delete(projectAiConfigs)
    .where(eq(projectAiConfigs.projectId, projectId));

  return NextResponse.json({ configured: false });
}
