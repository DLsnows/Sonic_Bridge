import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { put, del, head } from "@vercel/blob";
import { randomBytes } from "crypto";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

// Magic byte signatures for whitelisted image formats
const MAGIC_BYTES: Record<string, number[][]> = {
  "image/jpeg": [[0xFF, 0xD8, 0xFF]],
  "image/png": [[0x89, 0x50, 0x4E, 0x47]],
  "image/gif": [[0x47, 0x49, 0x46, 0x38]],
  "image/webp": [[0x52, 0x49, 0x46, 0x46]], // "RIFF" + "WEBP" at offset 8, checked separately
};

async function validateMagicBytes(file: File): Promise<boolean> {
  const sig = MAGIC_BYTES[file.type];
  if (!sig) return false;
  const buf = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  for (const pattern of sig) {
    if (pattern.every((byte, i) => buf[i] === byte)) {
      // WebP: also check bytes 8-11 for "WEBP"
      if (file.type === "image/webp") {
        const webpTag = [0x57, 0x45, 0x42, 0x50]; // "WEBP"
        return webpTag.every((b, i) => buf[8 + i] === b);
      }
      return true;
    }
  }
  return false;
}

async function deleteBlobByPathname(pathname: string): Promise<void> {
  const blob = await head(pathname);
  await del(blob.url);
}

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
    if (!(await validateMagicBytes(file))) {
      return Response.json({ error: "File content does not match its declared image type." }, { status: 400 });
    }

    const [currentUser] = await db
      .select({ avatar: users.avatar })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const storageKey = `avatars/${userId}_${randomBytes(8).toString("hex")}.jpg`;
    await put(storageKey, file, { access: "private", addRandomSuffix: false });

    await db.update(users).set({ avatar: storageKey }).where(eq(users.id, userId));

    const oldAvatar = currentUser?.avatar;
    if (oldAvatar) {
      try { await deleteBlobByPathname(oldAvatar); } catch { /* orphaned blob acceptable */ }
    }

    return Response.json({ avatar: `/api/user/avatar/${userId}` });
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

    const oldAvatar = currentUser?.avatar;
    if (oldAvatar) {
      try { await deleteBlobByPathname(oldAvatar); } catch { /* orphaned blob acceptable */ }
    }

    return Response.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
