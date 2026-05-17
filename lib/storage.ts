import fs from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";

const STORAGE_ROOT = path.join(process.cwd(), "storage");

export function getStorageKey(
  projectId: string,
  folderPath: string,
  filename: string,
): string {
  const uniqueName = `${randomBytes(8).toString("hex")}_${filename}`;
  return path.join(projectId, folderPath, uniqueName).replace(/\\/g, "/");
}

export async function saveFile(
  projectId: string,
  folderPath: string,
  file: File,
): Promise<{ storageKey: string; fullPath: string }> {
  const storageKey = getStorageKey(projectId, folderPath, file.name);
  const fullPath = path.join(STORAGE_ROOT, storageKey);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(fullPath, buffer);
  return { storageKey, fullPath };
}

export async function readFile(storageKey: string): Promise<Buffer> {
  const fullPath = path.join(STORAGE_ROOT, storageKey);
  return fs.readFile(fullPath);
}

export async function deleteFile(storageKey: string): Promise<void> {
  const fullPath = path.join(STORAGE_ROOT, storageKey);
  await fs.unlink(fullPath);
}

export async function deleteFolderContents(
  projectId: string,
  folderPath: string,
): Promise<void> {
  const dirPath = path.join(STORAGE_ROOT, projectId, folderPath);
  await fs.rm(dirPath, { recursive: true, force: true });
}
