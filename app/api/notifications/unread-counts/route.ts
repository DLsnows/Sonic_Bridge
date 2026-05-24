import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  notifications,
  discussionPosts,
  files,
  scheduleEvents,
  projectMembers,
  projectViews,
} from "@/lib/db/schema";
import { eq, and, isNull, gte, inArray, ne, gt, count } from "drizzle-orm";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = session.user.id as string;
    const memberOf = await db.select({ projectId: projectMembers.projectId }).from(projectMembers).where(eq(projectMembers.userId, userId));
    const projectIds = memberOf.map((m) => m.projectId);
    if (projectIds.length === 0) return NextResponse.json({ counts: {} });

    const lastViewedMap = new Map<string, Date>();
    try {
      const views = await db.select().from(projectViews).where(and(eq(projectViews.userId, userId), inArray(projectViews.projectId, projectIds)));
      for (const v of views) lastViewedMap.set(v.projectId, v.lastViewedAt);
    } catch (e) { console.error("[unread-counts] projectViews:", e); }

    const counts: Record<string, { total: number; threads: number; files: number; events: number }> = {};
    for (const pid of projectIds) {
      const since = lastViewedMap.get(pid);
      let threadCount = 0, fileCount = 0, eventCount = 0;
      try { const conds = [eq(discussionPosts.projectId, pid), isNull(discussionPosts.parentId), ne(discussionPosts.isAiGenerated, true)]; if (since) conds.push(gt(discussionPosts.createdAt, since)); const [r] = await db.select({ c: count() }).from(discussionPosts).where(and(...conds)); threadCount = r?.c ?? 0; } catch { /* nf */ }
      try { const conds = [eq(notifications.userId, userId), eq(notifications.projectId, pid), eq(notifications.type, "reply_to_user")]; if (since) conds.push(gt(notifications.createdAt, since)); const [r] = await db.select({ c: count() }).from(notifications).where(and(...conds)); threadCount += r?.c ?? 0; } catch { /* nf */ }
      try { const conds = [eq(files.projectId, pid)]; if (since) conds.push(gt(files.uploadedAt, since)); const [r] = await db.select({ c: count() }).from(files).where(and(...conds)); fileCount = r?.c ?? 0; } catch { /* nf */ }
      try { const conds = [eq(scheduleEvents.projectId, pid), gte(scheduleEvents.startTime, new Date())]; if (since) conds.push(gt(scheduleEvents.createdAt, since)); const [r] = await db.select({ c: count() }).from(scheduleEvents).where(and(...conds)); eventCount = r?.c ?? 0; } catch { /* nf */ }
      const total = threadCount + fileCount + eventCount;
      if (total > 0) counts[pid] = { total, threads: threadCount, files: fileCount, events: eventCount };
    }
    return NextResponse.json({ counts });
  } catch (e) { console.error("[unread-counts] fatal:", e); return NextResponse.json({ counts: {} }); }
}
