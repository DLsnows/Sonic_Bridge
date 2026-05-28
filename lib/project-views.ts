import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export async function upsertProjectView(userId: string, projectId: string) {
  await db.execute(sql`
    INSERT INTO project_views (user_id, project_id, last_viewed_at)
    VALUES (${userId}, ${projectId}, NOW())
    ON CONFLICT (user_id, project_id)
    DO UPDATE SET last_viewed_at = NOW()
  `);
}
