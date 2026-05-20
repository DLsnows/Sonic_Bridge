import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function resolveProjectId(id: string): Promise<string | null> {
  const isUuid = UUID_RE.test(id);
  const [project] = isUuid
    ? await db.select({ id: projects.id }).from(projects).where(eq(projects.id, id)).limit(1)
    : await db.select({ id: projects.id }).from(projects).where(eq(projects.customId, id)).limit(1);
  return project?.id ?? null;
}

export function projectHref(project: { customId: string | null; id: string }): string {
  return `/projects/${project.customId || project.id}`;
}
