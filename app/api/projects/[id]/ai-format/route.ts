import { NextRequest, NextResponse } from "next/server";
import { connection } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { discussionPosts, users, projectAiConfigs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { decrypt } from "@/lib/encryption";

const bodySchema = z.object({
  postId: z.string().uuid(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { postId } = parsed.data;

  const [post] = await db
    .select()
    .from(discussionPosts)
    .where(eq(discussionPosts.id, postId))
    .limit(1);

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  if (post.content.length < 20) {
    return NextResponse.json(
      { error: "Post too short to format (min 20 characters)" },
      { status: 400 },
    );
  }

  await connection();

  let aiUrl: string;
  let aiKey: string;
  let aiModel: string;

  // Try DB config first, then fall back to env vars
  const [dbConfig] = await db
    .select()
    .from(projectAiConfigs)
    .where(eq(projectAiConfigs.projectId, projectId))
    .limit(1);

  if (dbConfig) {
    aiUrl = dbConfig.apiUrl;
    try {
      aiKey = decrypt(dbConfig.encryptedApiKey);
    } catch {
      console.error("Failed to decrypt AI API key - AUTH_SECRET may have changed");
      return NextResponse.json(
        { error: "AI formatting not configured. Ask a project admin to reconfigure it in Project Settings." },
        { status: 503 },
      );
    }
    aiModel = dbConfig.model;
  } else {
    aiUrl = process.env.AI_API_URL ?? "";
    aiKey = process.env.AI_API_KEY ?? "";
    aiModel = process.env.AI_MODEL || "gpt-4o-mini";
  }

  if (!aiUrl || !aiKey) {
    const missing = !aiUrl && !aiKey ? "AI_API_URL and AI_API_KEY" : !aiUrl ? "AI_API_URL" : "AI_API_KEY";
    console.error(`AI formatting not configured: missing ${missing}`);
    return NextResponse.json(
      { error: "AI formatting not configured. Ask a project admin to configure it in Project Settings." },
      { status: 503 },
    );
  }

  let formattedContent: string;
  try {
    const aiRes = await fetch(aiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${aiKey}`,
      },
      body: JSON.stringify({
        model: aiModel,
        messages: [
          {
            role: "system",
            content:
              "You format raw text into clean Markdown. Fix grammar and punctuation. Add headings, lists, and formatting where appropriate. Do NOT add new information, do NOT change the meaning, do NOT add commentary. Only output the formatted markdown — no preamble, no explanation.",
          },
          { role: "user", content: post.content },
        ],
        temperature: 0.3,
        max_tokens: 4000,
      }),
    });

    if (!aiRes.ok) {
      return NextResponse.json(
        { error: `AI service error (${aiRes.status})` },
        { status: 502 },
      );
    }

    const data = await aiRes.json();
    formattedContent = data.choices?.[0]?.message?.content?.trim();
    if (!formattedContent) {
      return NextResponse.json(
        { error: "AI returned empty response" },
        { status: 502 },
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Failed to reach AI service" },
      { status: 502 },
    );
  }

  const [reply] = await db
    .insert(discussionPosts)
    .values({
      projectId: post.projectId,
      userId: session.user.id,
      title: `AI formatted: ${post.title}`,
      content: formattedContent,
      parentId: post.id,
      isEdited: false,
    })
    .returning();

  const [author] = await db
    .select({ username: users.username })
    .from(users)
    .where(eq(users.id, reply.userId))
    .limit(1);

  return NextResponse.json({
    ...reply,
    username: author?.username ?? "unknown",
  }, { status: 201 });
}
