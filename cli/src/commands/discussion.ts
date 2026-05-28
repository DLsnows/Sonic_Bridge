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

export interface DiscussionPost {
  id: string;
  projectId: string;
  userId: string;
  username: string;
  avatar?: string | null;
  title: string;
  content: string;
  parentId: string | null;
  isEdited: boolean;
  isAiGenerated: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CreatePostResponse extends DiscussionPost {}

export interface DiscussionFlags {
  title?: string;
  content?: string;
  project?: string;
  json?: boolean;
}

function shortId(id: string): string {
  return id.length > 8 ? id.slice(0, 8) : id;
}

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) {
    // Stdin is a TTY — nothing was piped. Don't hang.
    return "";
  }
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin as AsyncIterable<Buffer>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * Builds a thread tree from a flat post list and renders it.
 * Exported for testing.
 */
export function renderThread(root: DiscussionPost, all: DiscussionPost[]): string {
  const byParent = new Map<string, DiscussionPost[]>();
  for (const p of all) {
    if (!p.parentId) continue;
    const arr = byParent.get(p.parentId) ?? [];
    arr.push(p);
    byParent.set(p.parentId, arr);
  }
  for (const arr of byParent.values()) {
    arr.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  const lines: string[] = [];
  const aiTag = (p: DiscussionPost) => (p.isAiGenerated ? " [AI]" : "");
  lines.push(
    `${root.title}${aiTag(root)} — by ${root.username} @ ${root.createdAt}`,
  );
  lines.push("-----");
  lines.push(root.content);
  lines.push("-----");

  function walk(parent: DiscussionPost, depth: number): void {
    const children = byParent.get(parent.id) ?? [];
    const indent = "    ".repeat(depth);
    children.forEach((child, idx) => {
      const isLast = idx === children.length - 1;
      const connector = isLast ? "└──" : "├──";
      lines.push(
        `${indent}${connector} ${shortId(child.id)} by ${child.username}${aiTag(child)} @ ${child.createdAt}`,
      );
      const contentIndent = `${indent}    `;
      for (const contentLine of child.content.split("\n")) {
        lines.push(`${contentIndent}${contentLine}`);
      }
      walk(child, depth + 1);
    });
  }
  walk(root, 0);

  return lines.join("\n");
}

export async function runDiscussionLs(flags: DiscussionFlags): Promise<void> {
  const cfg = await loadConfig();
  try {
    const projectId = resolveActiveProject(cfg, flags.project);
    const posts = await apiFetch<DiscussionPost[]>(
      `/api/projects/${encodeURIComponent(projectId)}/discussion`,
    );
    if (wantsJson(flags)) {
      console.log(JSON.stringify(posts, null, 2));
      return;
    }
    const threads = posts.filter((p) => p.parentId === null);
    if (threads.length === 0) {
      console.log(pc.dim("(no discussion threads)"));
      return;
    }
    // Compute reply counts: every non-top-level post counts toward its
    // root ancestor. Build parent→ancestor map once.
    const byId = new Map(posts.map((p) => [p.id, p] as const));
    const rootOf = (post: DiscussionPost): string => {
      let cur: DiscussionPost | undefined = post;
      const seen = new Set<string>();
      // Cycle guard: if the server returns malformed parentId data that loops
      // (A -> B -> A), bail out and treat the current node as the root.
      while (cur && cur.parentId && !seen.has(cur.id)) {
        seen.add(cur.id);
        cur = byId.get(cur.parentId);
      }
      return cur ? cur.id : post.id;
    };
    const counts = new Map<string, number>();
    for (const p of posts) {
      if (p.parentId === null) continue;
      const r = rootOf(p);
      counts.set(r, (counts.get(r) ?? 0) + 1);
    }

    const rows = threads.map((t) => ({
      id: shortId(t.id),
      title: t.title,
      author: t.username,
      ai: t.isAiGenerated ? "[AI]" : "",
      replies: counts.get(t.id) ?? 0,
      updated: t.updatedAt,
    }));
    console.log(
      renderTable(
        [
          { header: "id", key: "id" },
          { header: "title", key: "title" },
          { header: "author", key: "author" },
          { header: "ai", key: "ai" },
          { header: "replies", key: "replies" },
          { header: "updated", key: "updated" },
        ],
        rows,
      ),
    );
  } catch (err) {
    console.error(pc.red(formatApiError(err)));
    process.exit(1);
  }
}

export async function runDiscussionRead(
  postId: string,
  flags: DiscussionFlags,
): Promise<void> {
  const cfg = await loadConfig();
  try {
    const projectId = resolveActiveProject(cfg, flags.project);
    const posts = await apiFetch<DiscussionPost[]>(
      `/api/projects/${encodeURIComponent(projectId)}/discussion`,
    );
    // Accept either the full id or a short prefix (matching the `ls` display).
    const root =
      posts.find((p) => p.id === postId) ??
      posts.find((p) => p.id.startsWith(postId));
    if (!root) {
      console.error(pc.red(`Post ${postId} not found in this project.`));
      process.exit(1);
    }
    // If the user passed a reply id, walk up to its root for thread context.
    let effectiveRoot = root;
    const byId = new Map(posts.map((p) => [p.id, p] as const));
    const seenWalk = new Set<string>();
    // Cycle guard: bail if the server returns malformed cyclic parentId data.
    while (effectiveRoot.parentId && !seenWalk.has(effectiveRoot.id)) {
      seenWalk.add(effectiveRoot.id);
      const parent = byId.get(effectiveRoot.parentId);
      if (!parent) break;
      effectiveRoot = parent;
    }

    if (wantsJson(flags)) {
      // Collect the root + all descendants.
      const wanted = new Set<string>([effectiveRoot.id]);
      // BFS through children layers.
      let frontier = [effectiveRoot.id];
      while (frontier.length > 0) {
        const next: string[] = [];
        for (const p of posts) {
          if (p.parentId && frontier.includes(p.parentId)) {
            if (!wanted.has(p.id)) {
              wanted.add(p.id);
              next.push(p.id);
            }
          }
        }
        frontier = next;
      }
      const subset = posts.filter((p) => wanted.has(p.id));
      console.log(JSON.stringify(subset, null, 2));
      return;
    }

    console.log(renderThread(effectiveRoot, posts));
  } catch (err) {
    console.error(pc.red(formatApiError(err)));
    process.exit(1);
  }
}

async function resolveContent(
  flagContent: string | undefined,
): Promise<string> {
  if (flagContent === undefined) {
    throw new Error("--content is required (use '-' to read from stdin).");
  }
  if (flagContent === "-") {
    const piped = (await readStdin()).trim();
    if (!piped) {
      throw new Error("--content '-' was given but stdin was empty.");
    }
    return piped;
  }
  return flagContent;
}

export async function runDiscussionPost(flags: DiscussionFlags): Promise<void> {
  const cfg = await loadConfig();
  try {
    if (!flags.title || !flags.title.trim()) {
      console.error(pc.red("--title is required and must be non-empty."));
      process.exit(1);
    }
    const projectId = resolveActiveProject(cfg, flags.project);
    const content = (await resolveContent(flags.content)).trim();
    if (!content) {
      console.error(pc.red("--content must be non-empty."));
      process.exit(1);
    }

    const created = await apiFetch<CreatePostResponse>(
      `/api/projects/${encodeURIComponent(projectId)}/discussion`,
      {
        method: "POST",
        body: {
          hasParent: false,
          title: flags.title.trim(),
          content,
        },
      },
    );

    if (wantsJson(flags)) {
      console.log(JSON.stringify(created, null, 2));
    } else {
      console.log(pc.green(`Created post ${created.id}`));
      console.log(
        pc.dim(
          "Note: writes via the CLI token are flagged isAiGenerated=true and will display an [AI] badge in the web UI.",
        ),
      );
    }
  } catch (err) {
    console.error(pc.red(formatApiError(err)));
    process.exit(1);
  }
}

export async function runDiscussionReply(
  parentPostId: string,
  flags: DiscussionFlags,
): Promise<void> {
  const cfg = await loadConfig();
  try {
    const projectId = resolveActiveProject(cfg, flags.project);
    const content = (await resolveContent(flags.content)).trim();
    if (!content) {
      console.error(pc.red("--content must be non-empty."));
      process.exit(1);
    }

    const created = await apiFetch<CreatePostResponse>(
      `/api/projects/${encodeURIComponent(projectId)}/discussion`,
      {
        method: "POST",
        body: {
          hasParent: true,
          parentId: parentPostId,
          content,
        },
      },
    );

    if (wantsJson(flags)) {
      console.log(JSON.stringify(created, null, 2));
    } else {
      console.log(
        pc.green(
          `Replied to ${parentPostId} (new post id: ${created.id}).`,
        ),
      );
      console.log(
        pc.dim(
          "Note: writes via the CLI token are flagged isAiGenerated=true and will display an [AI] badge in the web UI.",
        ),
      );
    }
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      console.error(pc.red(`Parent post ${parentPostId} not found.`));
      process.exit(1);
      return;
    }
    console.error(pc.red(formatApiError(err)));
    process.exit(1);
  }
}

export const DISCUSSION_HELP = {
  name: "discussion",
  summary: "Read project discussion threads and post / reply from the terminal.",
  body: [
    "Usage:",
    "  sonicbridge discussion ls [--project <p>] [--json]",
    "  sonicbridge discussion read <postId> [--project <p>] [--json]",
    "  sonicbridge discussion post --title <t> --content <c|-> [--project <p>] [--json]",
    "  sonicbridge discussion reply <postId> --content <c|-> [--project <p>] [--json]",
    "",
    "`--content -` reads the post body from stdin (handy for piping in a file).",
    "Every write made through a CLI token is stamped `isAiGenerated=true` on",
    "the server side. The CLI surfaces this with an `[AI]` badge in `ls` and",
    "`read` output to mirror what humans see in the web UI.",
  ].join("\n"),
};
