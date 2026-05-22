import { db } from "@/lib/db";
import { projectViews } from "@/lib/db/schema";

export async function upsertProjectView(userId: string, projectId: string) {
  await db
    .insert(projectViews)
    .values({ userId, projectId, lastViewedAt: new Date() })
    .onConflictDoUpdate({
      target: [projectViews.userId, projectViews.projectId],
      set: { lastViewedAt: new Date() },
    });
}
