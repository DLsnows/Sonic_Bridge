import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  notifications,
  files,
  scheduleEvents,
  projectMembers,
  projectViews,
} from "@/lib/db/schema";
import { eq, and, gte, inArray, gt, count } from "drizzle-orm";

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
      return NextResponse.json({ counts: {} });
    }

    // Get last viewed timestamps (fail gracefully if table missing)
    const lastViewedMap = new Map<string, Date>();
    try {
      const views = await db
        .select()
        .from(projectViews)
        .where(
          and(
            eq(projectViews.userId, userId),
            inArray(projectViews.projectId, projectIds),
          ),
        );
      for (const v of views) lastViewedMap.set(v.projectId, v.lastViewedAt);
    } catch { /* project_views table may not exist yet */ }

    const counts: Record<string, number> = {};

    for (const pid of projectIds) {
      const since = lastViewedMap.get(pid);
      let unread = 0;

      // New files
      try {
        const fileConds = [eq(files.projectId, pid)];
        if (since) fileConds.push(gt(files.uploadedAt, since));
        const [fr] = await db.select({ c: count() }).from(files).where(and(...fileConds));
        unread += fr?.c ?? 0;
      } catch { /* query may fail on schema mismatch */ }

      // Upcoming events
      try {
        const eventConds = [eq(scheduleEvents.projectId, pid), gte(scheduleEvents.startTime, new Date())];
        if (since) eventConds.push(gt(scheduleEvents.createdAt, since));
        const [er] = await db.select({ c: count() }).from(scheduleEvents).where(and(...eventConds));
        unread += er?.c ?? 0;
      } catch { /* query may fail on schema mismatch */ }

      // Unread new_post and reply_to_user notifications
      try {
        const [nr] = await db
          .select({ c: count() })
          .from(notifications)
          .where(and(
            eq(notifications.userId, userId),
            eq(notifications.projectId, pid),
            eq(notifications.isRead, false),
          ));
        unread += nr?.c ?? 0;
      } catch { /* notifications table may not exist yet */ }

      if (unread > 0) counts[pid] = unread;
    }

    return NextResponse.json({ counts });
  } catch (e) {
    console.error("[unread-counts] fatal error:", e);
    return NextResponse.json({ counts: {}, error: String(e) }, { status: 200 });
  }
}
