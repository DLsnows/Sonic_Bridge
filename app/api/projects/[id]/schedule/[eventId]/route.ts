import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { scheduleEvents } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { resolveProjectId } from "@/lib/project-utils";
import { authenticate } from "@/lib/api-auth";

const updateEventSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  startTime: z
    .string()
    .refine((s) => !isNaN(Date.parse(s)), "Invalid start time")
    .optional(),
  endTime: z
    .string()
    .refine((s) => !isNaN(Date.parse(s)), "Invalid end time")
    .optional(),
  type: z.enum(["meeting", "production", "release", "other"]).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; eventId: string }> },
) {
  const { id: rawId, eventId } = await params;
  const authResult = await authenticate(request, rawId);
  if (authResult instanceof Response) return authResult;

  const projectId = await resolveProjectId(rawId);
  if (!projectId) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  const userId = authResult.userId;

  const [existing] = await db
    .select()
    .from(scheduleEvents)
    .where(
      and(eq(scheduleEvents.id, eventId), eq(scheduleEvents.projectId, projectId)),
    )
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (existing.createdBy !== userId && authResult.membership.role !== "admin") {
    return NextResponse.json({ error: "Only creator or admin can edit" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = updateEventSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) updates.title = parsed.data.title;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;
  if (parsed.data.type !== undefined) updates.type = parsed.data.type;
  if (parsed.data.startTime !== undefined) updates.startTime = new Date(parsed.data.startTime);
  if (parsed.data.endTime !== undefined) updates.endTime = new Date(parsed.data.endTime);

  const startTime = (updates.startTime as Date) ?? existing.startTime;
  const endTime = (updates.endTime as Date) ?? existing.endTime;

  if (endTime <= startTime) {
    return NextResponse.json(
      { error: "End time must be after start time" },
      { status: 400 },
    );
  }

  const [updated] = await db
    .update(scheduleEvents)
    .set(updates)
    .where(eq(scheduleEvents.id, eventId))
    .returning();

  return NextResponse.json({ event: updated });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; eventId: string }> },
) {
  const { id: rawId, eventId } = await params;
  const authResult = await authenticate(request, rawId);
  if (authResult instanceof Response) return authResult;

  const projectId = await resolveProjectId(rawId);
  if (!projectId) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  const userId = authResult.userId;

  const [existing] = await db
    .select()
    .from(scheduleEvents)
    .where(
      and(eq(scheduleEvents.id, eventId), eq(scheduleEvents.projectId, projectId)),
    )
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (existing.createdBy !== userId && authResult.membership.role !== "admin") {
    return NextResponse.json({ error: "Only creator or admin can delete" }, { status: 403 });
  }

  await db.delete(scheduleEvents).where(eq(scheduleEvents.id, eventId));

  return NextResponse.json({ success: true });
}
