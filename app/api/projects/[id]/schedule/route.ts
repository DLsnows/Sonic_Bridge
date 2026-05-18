import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { scheduleEvents, projectMembers, users } from "@/lib/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { z } from "zod";

const dateParamSchema = z.string().refine((s) => !isNaN(Date.parse(s)), "Invalid date");

const createEventSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).nullable().optional(),
  startTime: z.string().refine((s) => !isNaN(Date.parse(s)), "Invalid start time"),
  endTime: z.string().refine((s) => !isNaN(Date.parse(s)), "Invalid end time"),
  type: z.enum(["meeting", "production", "release", "other"]).default("other"),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const userId = (session.user as any).id as string;

  const [membership] = await db
    .select()
    .from(projectMembers)
    .where(
      and(eq(projectMembers.projectId, id), eq(projectMembers.userId, userId)),
    )
    .limit(1);

  if (!membership) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const url = new URL(request.url);
  const startDate = url.searchParams.get("startDate");
  const endDate = url.searchParams.get("endDate");

  const conditions = [eq(scheduleEvents.projectId, id)];

  if (startDate) {
    const parsed = dateParamSchema.safeParse(startDate);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid startDate" }, { status: 400 });
    }
    conditions.push(gte(scheduleEvents.endTime, new Date(startDate)));
  }
  if (endDate) {
    const parsed = dateParamSchema.safeParse(endDate);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid endDate" }, { status: 400 });
    }
    conditions.push(lte(scheduleEvents.startTime, new Date(endDate)));
  }

  const events = await db
    .select({
      id: scheduleEvents.id,
      projectId: scheduleEvents.projectId,
      title: scheduleEvents.title,
      description: scheduleEvents.description,
      startTime: scheduleEvents.startTime,
      endTime: scheduleEvents.endTime,
      type: scheduleEvents.type,
      createdBy: scheduleEvents.createdBy,
      createdAt: scheduleEvents.createdAt,
      creatorName: users.username,
    })
    .from(scheduleEvents)
    .innerJoin(users, eq(scheduleEvents.createdBy, users.id))
    .where(and(...conditions))
    .orderBy(scheduleEvents.startTime);

  return NextResponse.json({ events, myRole: membership.role });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const userId = (session.user as any).id as string;

  const [membership] = await db
    .select()
    .from(projectMembers)
    .where(
      and(eq(projectMembers.projectId, id), eq(projectMembers.userId, userId)),
    )
    .limit(1);

  if (!membership) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = createEventSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { title, description, startTime, endTime, type } = parsed.data;
  const start = new Date(startTime);
  const end = new Date(endTime);

  if (end <= start) {
    return NextResponse.json(
      { error: "End time must be after start time" },
      { status: 400 },
    );
  }

  const [event] = await db
    .insert(scheduleEvents)
    .values({
      projectId: id,
      title,
      description: description ?? null,
      startTime: start,
      endTime: end,
      type,
      createdBy: userId,
    })
    .returning();

  return NextResponse.json({ event }, { status: 201 });
}
