import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { put, del } from "@vercel/blob";
import { randomBytes } from "crypto";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = (session.user as any).id as string;

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return Response.json({ error: "Invalid form data" }, { status: 400 });
    }

    const file = formData.get("file") as File | null;
    if (!file) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return Response.json({ error: "Only JPEG, PNG, GIF, and WebP images are allowed." }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return Response.json({ error: "Image must be under 5 MB." }, { status: 400 });
    }

    const [currentUser] = await db
      .select({ avatar: users.avatar })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const storageKey = `avatars/${userId}_${randomBytes(8).toString("hex")}.jpg`;
    const result = await put(storageKey, file, { access: "public", addRandomSuffix: false });

    await db.update(users).set({ avatar: result.url }).where(eq(users.id, userId));

    const oldUrl = currentUser?.avatar;
    if (oldUrl && oldUrl.includes("blob.vercel-storage.com")) {
      try { await del(oldUrl); } catch { /* orphaned blob acceptable */ }
    }

    return Response.json({ avatar: result.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = (session.user as any).id as string;

    const [currentUser] = await db
      .select({ avatar: users.avatar })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    await db.update(users).set({ avatar: null }).where(eq(users.id, userId));

    const oldUrl = currentUser?.avatar;
    if (oldUrl && oldUrl.includes("blob.vercel-storage.com")) {
      try { await del(oldUrl); } catch { /* orphaned blob acceptable */ }
    }

    return Response.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
