import pc from "picocolors";
import {
  apiFetch,
  ApiError,
  formatApiError,
  resolveActiveProject,
  wantsJson,
} from "../api.js";
import { loadConfig } from "../config.js";
import { renderTable } from "../util/table.js";
import { resolveByPrefix } from "../util/resolve-id.js";

// Disallow path separators and ASCII control characters in folder names.
// eslint-disable-next-line no-control-regex
const FOLDER_NAME_FORBIDDEN_RE = /[\\/\x00-\x1f\x7f]/;

interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  projectId: string;
  createdAt: string;
  createdBy: string;
}

interface FoldersListResponse {
  folders: Folder[];
}

interface FilesListResponse {
  files: Array<{
    id: string;
    name: string;
    size: number;
    mimeType: string;
    uploadedAt: string;
    uploaderName: string;
  }>;
  folderId: string | null;
}

export interface FoldersFlags {
  parent?: string;
  project?: string;
  json?: boolean;
}

/**
 * Renders folders as a tree under the root. Folders without a known parent
 * (orphans) are rendered at root level.
 */
function renderTree(folders: Folder[]): string {
  const byParent = new Map<string | null, Folder[]>();
  const ids = new Set(folders.map((f) => f.id));
  for (const f of folders) {
    const parentKey = f.parentId && ids.has(f.parentId) ? f.parentId : null;
    const arr = byParent.get(parentKey) ?? [];
    arr.push(f);
    byParent.set(parentKey, arr);
  }
  for (const arr of byParent.values()) arr.sort((a, b) => a.name.localeCompare(b.name));

  const lines: string[] = ["/"];
  function walk(parent: string | null, prefix: string) {
    const children = byParent.get(parent) ?? [];
    children.forEach((child, idx) => {
      const isLast = idx === children.length - 1;
      const connector = isLast ? "└── " : "├── ";
      lines.push(`${prefix}${connector}${child.name}  ${pc.dim(child.id)}`);
      const nextPrefix = `${prefix}${isLast ? "    " : "│   "}`;
      walk(child.id, nextPrefix);
    });
  }
  walk(null, "");
  return lines.join("\n");
}

export async function runFoldersLs(
  folderId: string | undefined,
  flags: FoldersFlags,
): Promise<void> {
  const cfg = await loadConfig();
  try {
    const projectId = resolveActiveProject(cfg, flags.project);

    if (folderId) {
      // List the contents (files) of a specific folder.
      const result = await apiFetch<FilesListResponse>(
        `/api/projects/${encodeURIComponent(projectId)}/files?folderId=${encodeURIComponent(folderId)}`,
      );
      if (wantsJson(flags)) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      if (result.files.length === 0) {
        console.log(pc.dim("(folder is empty)"));
        return;
      }
      console.log(
        renderTable(
          [
            { header: "id", key: "id" },
            { header: "name", key: "name" },
            { header: "size", key: "size" },
            { header: "uploadedAt", key: "uploadedAt" },
          ],
          result.files.map((f) => ({
            id: f.id,
            name: f.name,
            size: f.size,
            uploadedAt: f.uploadedAt,
          })),
        ),
      );
      return;
    }

    const result = await apiFetch<FoldersListResponse>(
      `/api/projects/${encodeURIComponent(projectId)}/folders`,
    );
    if (wantsJson(flags)) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    if (result.folders.length === 0) {
      console.log(pc.dim("(no folders)"));
      return;
    }
    console.log(renderTree(result.folders));
  } catch (err) {
    console.error(pc.red(formatApiError(err)));
    process.exit(1);
  }
}

export async function runFoldersMkdir(
  name: string,
  flags: FoldersFlags,
): Promise<void> {
  const cfg = await loadConfig();
  try {
    const projectId = resolveActiveProject(cfg, flags.project);
    const body: { name: string; parentId?: string } = { name };
    if (flags.parent) body.parentId = flags.parent;
    const created = await apiFetch<Folder>(
      `/api/projects/${encodeURIComponent(projectId)}/folders`,
      { method: "POST", body },
    );
    if (wantsJson(flags)) {
      console.log(JSON.stringify(created, null, 2));
    } else {
      console.log(pc.green(`Created folder ${created.name} (${created.id})`));
    }
  } catch (err) {
    console.error(pc.red(formatApiError(err)));
    process.exit(1);
  }
}

export async function runFoldersRm(
  folderId: string,
  flags: FoldersFlags,
): Promise<void> {
  const cfg = await loadConfig();
  try {
    const projectId = resolveActiveProject(cfg, flags.project);
    await apiFetch(
      `/api/projects/${encodeURIComponent(projectId)}/folders/${encodeURIComponent(folderId)}`,
      { method: "DELETE" },
    );
    console.log(pc.green(`Deleted folder ${folderId}.`));
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      const body = err.body as { error?: string } | null;
      if (body?.error === "folder_not_empty") {
        console.error(
          pc.red(
            `Folder ${folderId} is not empty. Delete its files/sub-folders first.`,
          ),
        );
        process.exit(1);
      }
    }
    console.error(pc.red(formatApiError(err)));
    process.exit(1);
  }
}

async function fetchAllFolders(projectId: string): Promise<Folder[]> {
  const res = await apiFetch<FoldersListResponse>(
    `/api/projects/${encodeURIComponent(projectId)}/folders`,
  );
  return res.folders;
}

export async function runFoldersRename(
  folderId: string,
  newName: string,
  flags: FoldersFlags,
): Promise<void> {
  const cfg = await loadConfig();
  try {
    const projectId = resolveActiveProject(cfg, flags.project);

    // Client-side validation. Server enforces max 200 via zod.
    if (!newName || newName.length === 0) {
      console.error(pc.red("New name cannot be empty."));
      process.exit(1);
      return;
    }
    if (newName.length > 200) {
      console.error(pc.red("New name is too long (max 200 chars)."));
      process.exit(1);
      return;
    }
    if (FOLDER_NAME_FORBIDDEN_RE.test(newName)) {
      console.error(
        pc.red("Invalid name — no path separators or control characters."),
      );
      process.exit(1);
      return;
    }

    // Resolve 8-char prefix → full UUID.
    let resolvedId: string;
    try {
      const match = await resolveByPrefix(
        folderId,
        () => fetchAllFolders(projectId),
        "folder",
      );
      resolvedId = match.id;
    } catch (err) {
      if (err instanceof Error && /No folder matches|prefix.*ambiguous/.test(err.message)) {
        console.error(pc.red(err.message));
        process.exit(1);
        return;
      }
      throw err;
    }

    try {
      const result = await apiFetch<{ folder: Folder }>(
        `/api/projects/${encodeURIComponent(projectId)}/folders/${encodeURIComponent(resolvedId)}`,
        { method: "PATCH", body: { name: newName } },
      );

      if (wantsJson(flags)) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      const prefix = resolvedId.slice(0, 8);
      console.log(
        pc.green(`Renamed folder → ${result.folder.name} (id: ${prefix}).`),
      );
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        console.error(pc.red(`Folder ${resolvedId} not found.`));
        process.exit(1);
        return;
      }
      throw err;
    }
  } catch (err) {
    console.error(pc.red(formatApiError(err)));
    process.exit(1);
  }
}
