import { put, del, list, head } from "@vercel/blob";
import { randomBytes } from "crypto";

export function getStorageKey(
  projectId: string,
  folderPath: string,
  filename: string,
): string {
  const uniqueName = `${randomBytes(8).toString("hex")}_${filename}`;
  return `${projectId}/${folderPath}/${uniqueName}`.replace(/\/+/g, "/");
}

export async function saveFile(
  projectId: string,
  folderPath: string,
  file: File,
): Promise<{ storageKey: string }> {
  const storageKey = getStorageKey(projectId, folderPath, file.name);
  await put(storageKey, file, { access: "private", addRandomSuffix: false });
  return { storageKey };
}

export async function getFileUrl(storageKey: string): Promise<string> {
  const blob = await head(storageKey);
  return blob.url;
}

export async function deleteFile(storageKey: string): Promise<void> {
  try {
    const blob = await head(storageKey);
    await del(blob.url);
  } catch {
    // Blob doesn't exist — nothing to delete
  }
}

export async function deleteFolderContents(
  projectId: string,
  folderPath: string,
): Promise<void> {
  let cursor: string | undefined;
  do {
    const result = await list({ prefix: `${projectId}/${folderPath}/`, cursor });
    if (result.blobs.length > 0) {
      await del(result.blobs.map((b) => b.url));
    }
    cursor = result.hasMore ? result.cursor : undefined;
  } while (cursor);
}
