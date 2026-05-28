import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  notifications,
  discussionPosts,
  files,
  scheduleEvents,
  projectMembers,
  users,
} from "@/lib/db/schema";
import { eq, desc, and, isNull, gte, inArray, asc, ne } from "drizzle-orm";

interface ActivityItem {
  id: string;
  projectId: string;
  type: string;
  referenceId: string;
  referenceType: string;
  isRead: boolean;
  createdAt: string;
  title?: string;
  actorName?: string;
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id as string;

    const memberOf = await db
      .select({ projectId: projectMembers.projectId })
      .from(projectMembers)
      .where(eq(projectMembers.userId, userId));
    const projectIds = memberOf.map((m) => m.projectId);

    if (projectIds.length === 0) {
      return NextResponse.json({ notifications: [] });
    }

    const seen = new Set<string>();
    const items: ActivityItem[] = [];

    const addItem = (item: ActivityItem) => {
      const key = `${item.referenceType}:${item.referenceId}:${item.type}`;
      if (!seen.has(key)) {
        seen.add(key);
        items.push(item);
      }
    };

    // 1. Targeted notifications from the notifications table
    const targetedNotifs = await db
      .select({
        id: notifications.id,
        projectId: notifications.projectId,
        type: notifications.type,
        referenceId: notifications.referenceId,
        referenceType: notifications.referenceType,
        isRead: notifications.isRead,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), inArray(notifications.projectId, projectIds)))
      .orderBy(desc(notifications.createdAt))
      .limit(50);

    const discPostIds = targetedNotifs
      .filter((n) => n.referenceType === "discussion_post")
      .map((n) => n.referenceId);
    const postMetaMap = new Map<string, { title: string; actorName: string }>();
    if (discPostIds.length > 0) {
      const postMetas = await db
        .select({ id: discussionPosts.id, title: discussionPosts.title, username: users.username })
        .from(discussionPosts)
        .innerJoin(users, eq(discussionPosts.userId, users.id))
        .where(inArray(discussionPosts.id, discPostIds));
      for (const p of postMetas) {
        postMetaMap.set(p.id, { title: p.title || "", actorName: p.username ?? "Unknown" });
      }
    }

    for (const n of targetedNotifs) {
      const meta = postMetaMap.get(n.referenceId);
      addItem({
        id: n.id, projectId: n.projectId, type: n.type,
        referenceId: n.referenceId, referenceType: n.referenceType,
        isRead: n.isRead, createdAt: n.createdAt.toISOString(),
        title: meta?.title, actorName: meta?.actorName,
      });
    }

    // 2. Recent discussion threads (source-table fallback)
    const threads = await db
      .select({
        id: discussionPosts.id, projectId: discussionPosts.projectId,
        title: discussionPosts.title, username: users.username,
        createdAt: discussionPosts.createdAt,
      })
      .from(discussionPosts)
      .innerJoin(users, eq(discussionPosts.userId, users.id))
      .where(and(
        inArray(discussionPosts.projectId, projectIds),
        isNull(discussionPosts.parentId),
        ne(discussionPosts.isAiGenerated, true),
        ne(discussionPosts.userId, userId),
      ))
      .orderBy(desc(discussionPosts.createdAt))
      .limit(15);

    for (const t of threads) {
      addItem({
        id: t.id, projectId: t.projectId, type: "new_post",
        referenceId: t.id, referenceType: "discussion_post",
        isRead: false, createdAt: t.createdAt.toISOString(),
        title: t.title, actorName: t.username ?? undefined,
      });
    }

    // 3. Recent files
    const recentFiles = await db
      .select({
        id: files.id, projectId: files.projectId, name: files.name,
        username: users.username, uploadedAt: files.uploadedAt,
      })
      .from(files)
      .innerJoin(users, eq(files.uploadedBy, users.id))
      .where(and(inArray(files.projectId, projectIds), ne(files.uploadedBy, userId)))
      .orderBy(desc(files.uploadedAt))
      .limit(15);

    for (const f of recentFiles) {
      addItem({
        id: f.id, projectId: f.projectId, type: "new_file",
        referenceId: f.id, referenceType: "file",
        isRead: false, createdAt: f.uploadedAt.toISOString(),
        title: f.name, actorName: f.username ?? undefined,
      });
    }

    // 4. Upcoming events
    const events = await db
      .select({
        id: scheduleEvents.id, projectId: scheduleEvents.projectId,
        title: scheduleEvents.title, username: users.username,
        startTime: scheduleEvents.startTime, createdAt: scheduleEvents.createdAt,
      })
      .from(scheduleEvents)
      .innerJoin(users, eq(scheduleEvents.createdBy, users.id))
      .where(and(inArray(scheduleEvents.projectId, projectIds), gte(scheduleEvents.startTime, new Date()), ne(scheduleEvents.createdBy, userId)))
      .orderBy(asc(scheduleEvents.startTime))
      .limit(15);

    for (const e of events) {
      addItem({
        id: e.id, projectId: e.projectId, type: "new_event",
        referenceId: e.id, referenceType: "schedule_event",
        isRead: false, createdAt: e.createdAt.toISOString(),
        title: e.title, actorName: e.username ?? undefined,
      });
    }

    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return NextResponse.json({ notifications: items.slice(0, 50) });
  } catch (e) {
    console.error("[notif] GET fatal:", e);
    return NextResponse.json({ notifications: [] }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id as string;
  const { notificationId } = await request.json().catch(() => ({}));
  if (!notificationId) return NextResponse.json({ error: "Missing notificationId" }, { status: 400 });
  await db.update(notifications).set({ isRead: true })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));
  return NextResponse.json({ success: true });
}

export async function PATCH() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id as string;
  await db.update(notifications).set({ isRead: true })
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  return NextResponse.json({ success: true });
}
