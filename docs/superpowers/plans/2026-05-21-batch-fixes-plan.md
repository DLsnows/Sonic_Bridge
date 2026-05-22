# Batch Fixes May 2026 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 9 issues across Discussion board, UI components, file system, Creative Space, and build VST3 plugin.

**Architecture:** Three independent workstreams (fix/discussion-ai, fix/ui-quick-fixes, feat/file-system) each branched from dev, implemented in parallel, merged via PR to dev. VST3 build runs after all merges.

**Tech Stack:** Next.js 16.2.6, React 19.2.4, TypeScript 5, Tailwind CSS 4, `@uiw/react-md-editor`, `@aws-sdk/s3-request-presigner`, `livekit-server-sdk`

---

## File Structure

```
components/
├── discussion/
│   ├── PostForm.tsx          (MODIFY: MDEditor replaces textarea)
│   └── ThreadCard.tsx        (MODIFY: MDEditor.Markdown, hide AI btn, nested replies)
├── CreativeSpaceStatus.tsx   (CREATE: live participant count)
├── files/
│   ├── UploadZone.tsx        (MODIFY: direct R2 upload)
│   ├── FileList.tsx          (MODIFY: inline audio player)
│   └── AudioPlayerModal.tsx  (CREATE: modal audio player)
├── NotificationBell.tsx      (MODIFY: dropdown position)
└── space/
    └── AudioMixer.tsx        (MODIFY: center position)

app/
├── (dashboard)/projects/[id]/page.tsx  (MODIFY: clickable links + space status)
└── api/projects/[id]/
    ├── files/
    │   ├── route.ts          (MODIFY: accept JSON metadata)
    │   └── upload-url/route.ts  (CREATE: presigned URL endpoint)
    └── space/status/route.ts    (CREATE: participant count)

lib/storage.ts               (MODIFY: add createPresignedUploadUrl)
package.json                  (MODIFY: add 2 dependencies)
```

---

## Group A: Discussion & AI (`fix/discussion-ai`)

### Task A1: Install @uiw/react-md-editor

**Files:** `package.json`

- [ ] **Step 1: Install dependency**

```bash
npm install @uiw/react-md-editor
```

- [ ] **Step 2: Verify install**

```bash
node -e "require('@uiw/react-md-editor'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add @uiw/react-md-editor for markdown editing/rendering"
```

---

### Task A2: Replace PostForm textarea with MDEditor

**Files:** Modify `components/discussion/PostForm.tsx`

- [ ] **Step 1: Replace textarea with MDEditor**

Replace the `<textarea>` block (lines 125-143) and the import section. The MDEditor component provides edit/preview/split modes built-in.

At top of file, add imports:

```tsx
import MDEditor from "@uiw/react-md-editor";
```

Replace the textarea block (lines 125-143) with:

```tsx
<div data-color-mode="dark">
  <MDEditor
    value={content}
    onChange={(val) => setContent(val ?? "")}
    preview={mode === "edit" ? "edit" : "live"}
    height={mode === "thread" ? 250 : 200}
    visibleDragbar={false}
    textareaProps={{
      placeholder:
        mode === "reply"
          ? "Write a reply..."
          : mode === "edit"
            ? "Edit your post..."
            : "Share your thoughts... (Markdown supported)",
      maxLength: 10000,
    }}
  />
</div>
```

- [ ] **Step 2: Add CSS import at top of file**

```tsx
import "@uiw/react-md-editor/markdown-editor.css";
```

- [ ] **Step 3: Remove the markdown hint text and cite-file button from below textarea**

Remove the `<p>` tag with "Styling with Markdown is supported" (lines 145-147). Keep the cite-file button but move it above the editor.

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors related to PostForm.

- [ ] **Step 5: Commit**

```bash
git add components/discussion/PostForm.tsx
git commit -m "feat: replace PostForm textarea with @uiw/react-md-editor"
```

---

### Task A3: Replace ThreadCard react-markdown with MDEditor.Markdown + theme

**Files:** Modify `components/discussion/ThreadCard.tsx`

- [ ] **Step 1: Replace imports**

Remove:
```tsx
import ReactMarkdown from "react-markdown";
```

Add:
```tsx
import MDEditor from "@uiw/react-md-editor";
import "@uiw/react-md-editor/markdown-editor.css";
```

- [ ] **Step 2: Remove markdownComponents map**

Delete lines 61-144 (the entire `markdownComponents` object and the `stripMarkdown` function at lines 40-51).

- [ ] **Step 3: Replace PostBody component**

Replace the `PostBody` function (lines 146-162) with:

```tsx
function PostBody({ post }: { post: DiscussionPost }) {
  return (
    <div data-color-mode="dark" className="space-y-3">
      <MDEditor.Markdown
        source={post.content}
        style={{
          background: "transparent",
          color: "#D0D0D0",
          fontSize: "14px",
        }}
      />
      {post.isEdited && (
        <span className="text-[10px] text-[#A0A0B0]/60 italic">(edited)</span>
      )}
      {post.isAiGenerated && (
        <span className="inline-block text-[10px] bg-[#FF8C00]/15 text-[#FF8C00] px-1.5 py-0.5 rounded font-mono ml-1">
          AI
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Update preview text extraction**

Replace the `stripMarkdown` call at line 204 with a simpler approach for the collapsed preview:

```tsx
const preview = post.content.replace(/[#*`\[\]>\-|\n]/g, " ").replace(/\s+/g, " ").trim().slice(0, 200);
```

- [ ] **Step 5: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors related to ThreadCard.

- [ ] **Step 6: Commit**

```bash
git add components/discussion/ThreadCard.tsx
git commit -m "feat: replace react-markdown with @uiw/react-md-editor Markdown renderer"
```

---

### Task A4: Hide AI Format on AI-generated posts

**Files:** Modify `components/discussion/ThreadCard.tsx`

- [ ] **Step 1: Add isAiGenerated guard to main post AI button**

At line 298, change condition from:
```tsx
{post.content.length > 20 && (
```
to:
```tsx
{post.content.length > 20 && !post.isAiGenerated && (
```

- [ ] **Step 2: Add isAiGenerated guard to reply AI button**

At line 449, change condition from:
```tsx
{reply.content.length > 20 && (
```
to:
```tsx
{reply.content.length > 20 && !reply.isAiGenerated && (
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/discussion/ThreadCard.tsx
git commit -m "fix: hide AI Format button on already AI-generated posts"
```

---

### Task A5: Add 2-level reply nesting in ThreadCard

**Files:** Modify `components/discussion/ThreadCard.tsx`

- [ ] **Step 1: Pass repliesMap to the replies section**

In the `ThreadCard` component, add `repliesMap` to props or access it. Since `repliesMap` is in `DiscussionBoard.tsx`, pass it as a new prop.

Add to `ThreadCardProps` interface (after `onSetEditing`):

```tsx
repliesMap: Map<string, DiscussionPost[]>;
```

- [ ] **Step 2: Add nested replies rendering**

In the replies section (inside `replies.map`, after the reply's editing/replying forms, before the closing `</div>` at line 498), add nested replies:

```tsx
{repliesMap.get(reply.id) && repliesMap.get(reply.id)!.length > 0 && (
  <div className="mt-2 ml-6 pl-3 border-l border-[#FF8C00]/5 space-y-2">
    {repliesMap.get(reply.id)!.map((nested) => (
      <div key={nested.id} className="animate-fade-in">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-4 h-4 rounded-full bg-[#FF8C00]/10 border border-[#FF8C00]/20 flex items-center justify-center text-[8px] text-[#FF8C00] font-['Share_Tech_Mono',monospace] shrink-0">
            {nested.username.charAt(0).toUpperCase()}
          </span>
          <span className="text-[10px] text-[#F0F0F0] font-medium">
            {nested.username}
          </span>
          <span className="text-[9px] text-[#A0A0B0]/60">
            {timeAgo(nested.createdAt)}
          </span>
        </div>
        <PostBody post={nested} />
        <div className="flex items-center gap-1 mt-1">
          {(nested.userId === currentUserId || isAdmin) && (
            <Button
              variant="ghost"
              size="sm"
              loading={deletingReplyId === nested.id}
              onClick={async () => {
                if (!confirm("Delete this reply?")) return;
                setDeletingReplyId(nested.id);
                setDeleteError(null);
                try { await onDelete(nested.id); } catch {
                  setDeleteError("Failed to delete reply");
                } finally { setDeletingReplyId(null); }
              }}
              className="hover:text-[#FF4444] text-[10px]"
            >
              Del
            </Button>
          )}
        </div>
      </div>
    ))}
  </div>
)}
```

- [ ] **Step 3: Update DiscussionBoard to pass repliesMap**

In `DiscussionBoard.tsx`, update the `ThreadCard` call (lines 241-256) to include `repliesMap`:

```tsx
<ThreadCard
  key={thread.id}
  post={thread}
  replies={repliesMap.get(thread.id) ?? []}
  repliesMap={repliesMap}
  currentUserId={currentUserId}
  isAdmin={isAdmin}
  projectId={projectId}
  replyingTo={replyingTo}
  editingId={editingId}
  onReply={handleReply}
  onEdit={handleEdit}
  onDelete={handleDelete}
  onAiFormat={handleAiFormat}
  onSetReplying={setReplyingTo}
  onSetEditing={setEditingId}
/>
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add components/discussion/ThreadCard.tsx components/discussion/DiscussionBoard.tsx
git commit -m "feat: add 2-level reply nesting to show AI-generated summaries on replies"
```

---

## Group B: UI Quick Fixes (`fix/ui-quick-fixes`)

### Task B1: Fix notification dropdown position

**Files:** Modify `components/NotificationBell.tsx`

- [ ] **Step 1: Update dropdown wrapper positioning**

At line 164, change the dropdown div from:
```tsx
<div ref={dropdownRef} className="mt-2">
  <NotificationDropdown onClose={() => setDropdownOpen(false)} />
</div>
```
to:
```tsx
<div ref={dropdownRef} className="absolute right-0 mt-2 z-50 min-w-[280px]">
  <NotificationDropdown onClose={() => setDropdownOpen(false)} />
</div>
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/NotificationBell.tsx
git commit -m "fix: anchor notification dropdown to bell button with absolute positioning"
```

---

### Task B2: Create CreativeSpaceStatus component + API

**Files:**
- Create: `components/CreativeSpaceStatus.tsx`
- Create: `app/api/projects/[id]/space/status/route.ts`

- [ ] **Step 1: Create the API endpoint**

Create `app/api/projects/[id]/space/status/route.ts`:

```tsx
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projectMembers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { RoomServiceClient } from "livekit-server-sdk";
import { resolveProjectId } from "@/lib/project-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const projectId = await resolveProjectId(id);
  if (!projectId) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const [membership] = await db
    .select()
    .from(projectMembers)
    .where(
      and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, session.user.id as string)),
    )
    .limit(1);

  if (!membership) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const livekitUrl = process.env.LIVEKIT_URL ?? "ws://localhost:7880";
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    return NextResponse.json({ participantCount: 0 });
  }

  try {
    const host = livekitUrl.replace(/^wss?:\/\//, "https://").replace(/:\d+/, (m) => m);
    const port = new URL(livekitUrl.replace(/^wss?:\/\//, "https://")).port || "443";
    const client = new RoomServiceClient(`${host}:${port}`, apiKey, apiSecret);
    const participants = await client.listParticipants(`project-${projectId}`);
    return NextResponse.json({ participantCount: participants.length });
  } catch {
    return NextResponse.json({ participantCount: 0 });
  }
}
```

- [ ] **Step 2: Create CreativeSpaceStatus client component**

Create `components/CreativeSpaceStatus.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

export function CreativeSpaceStatus({ projectId }: { projectId: string }) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let ignore = false;
    fetch(`/api/projects/${projectId}/space/status`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!ignore && d) setCount(d.participantCount ?? 0);
      })
      .catch(() => {});
    const interval = setInterval(() => {
      fetch(`/api/projects/${projectId}/space/status`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!ignore && d) setCount(d.participantCount ?? 0);
        })
        .catch(() => {});
    }, 30000);
    return () => { ignore = true; clearInterval(interval); };
  }, [projectId]);

  if (count === null) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-[#A0A0B0]" />
        <span className="text-[10px] text-[#A0A0B0]">Loading...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full ${count > 0 ? "bg-[#00FF41]" : "bg-[#A0A0B0]"}`} />
      <span className="text-[10px] text-[#A0A0B0]">
        {count > 0 ? `${count} online` : "Empty"}
      </span>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/CreativeSpaceStatus.tsx app/api/projects/\[id\]/space/status/route.ts
git commit -m "feat: add Creative Space online participant count display"
```

---

### Task B3: Make Recent Activity items clickable + add Creative Space status

**Files:** Modify `app/(dashboard)/projects/[id]/page.tsx`

- [ ] **Step 1: Add CreativeSpaceStatus import**

Add import at top:
```tsx
import { CreativeSpaceStatus } from "@/components/CreativeSpaceStatus";
```

- [ ] **Step 2: Add Creative Space section to Recent Activity panel**

After the "Recent Discussions" section (before the closing `</div>` at line 236), add:

```tsx
{/* Creative Space */}
<div>
  <h4 className="font-['Share_Tech_Mono',monospace] text-[10px] text-[#00F0FF] uppercase tracking-wider mb-2">
    Creative Space
  </h4>
  <CreativeSpaceStatus projectId={project.id} />
</div>
```

Note: This is a server component, so `CreativeSpaceStatus` is a client component rendered within it. This is fine in Next.js 16 — server components can import and render client components.

- [ ] **Step 3: Wrap Upcoming Events in Link tags**

Replace the upcoming events map (lines 183-190) to wrap each in a Link:

```tsx
{upcomingEvents.map((evt) => (
  <Link
    key={evt.id}
    href={`/projects/${project.id}/schedule?event=${evt.id}`}
    className="flex items-center justify-between text-xs hover:bg-white/[0.03] rounded px-1 py-0.5 -mx-1 transition-colors"
  >
    <span className="text-[#F0F0F0] truncate max-w-[180px]">{evt.title}</span>
    <span className="text-[#A0A0B0] font-mono text-[10px] shrink-0 ml-2">
      {evt.startTime.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
    </span>
  </Link>
))}
```

- [ ] **Step 4: Wrap Recent Files in Link tags**

Replace the recent files map (lines 204-211):

```tsx
{recentFiles.map((f) => (
  <Link
    key={f.id}
    href={`/projects/${project.id}/files?file=${f.id}`}
    className="flex items-center justify-between text-xs hover:bg-white/[0.03] rounded px-1 py-0.5 -mx-1 transition-colors"
  >
    <span className="text-[#F0F0F0] truncate max-w-[180px]">{f.name}</span>
    <span className="text-[#A0A0B0] font-mono text-[10px] shrink-0 ml-2">
      {(f.size / 1024).toFixed(0)} KB
    </span>
  </Link>
))}
```

- [ ] **Step 5: Wrap Recent Discussions in Link tags**

Replace the recent discussions map (lines 225-232):

```tsx
{recentThreads.map((post) => (
  <Link
    key={post.id}
    href={`/projects/${project.id}/discussion?post=${post.id}`}
    className="flex items-center justify-between text-xs hover:bg-white/[0.03] rounded px-1 py-0.5 -mx-1 transition-colors"
  >
    <span className="text-[#F0F0F0] truncate max-w-[180px]">{post.title}</span>
    <span className="text-[#A0A0B0] text-[10px] shrink-0 ml-2">
      {post.username}
    </span>
  </Link>
))}
```

- [ ] **Step 6: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add app/\(dashboard\)/projects/\[id\]/page.tsx
git commit -m "feat: make Recent Activity items clickable, add Creative Space online status"
```

---

### Task B4: Center Audio Mixer

**Files:** Modify `components/space/AudioMixer.tsx`

- [ ] **Step 1: Change positioning class**

At line 69, change:
```tsx
className="fixed right-4 top-[20%] z-40 w-72 bg-[#0A0A0F]/95 ...
```
to:
```tsx
className="fixed left-1/2 -translate-x-1/2 top-[20%] z-40 w-72 bg-[#0A0A0F]/95 ...
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/space/AudioMixer.tsx
git commit -m "fix: center Audio Mixer horizontally in Creative Space"
```

---

## Group C: File System (`feat/file-system`)

### Task C1: Install @aws-sdk/s3-request-presigner

**Files:** `package.json`

- [ ] **Step 1: Install dependency**

```bash
npm install @aws-sdk/s3-request-presigner
```

- [ ] **Step 2: Verify install**

```bash
node -e "require('@aws-sdk/s3-request-presigner'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add @aws-sdk/s3-request-presigner for R2 presigned URLs"
```

---

### Task C2: Add presigned URL function to storage.ts

**Files:** Modify `lib/storage.ts`

- [ ] **Step 1: Add import**

At top of file, add:
```tsx
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
```

- [ ] **Step 2: Add createPresignedUploadUrl function**

After the `getStorageKey` function (after line 62), add:

```tsx
export async function createPresignedUploadUrl(
  projectId: string,
  folderPath: string,
  filename: string,
  contentType: string,
): Promise<{ uploadUrl: string; publicUrl: string; storageKey: string }> {
  const storageKey = getStorageKey(projectId, folderPath, filename);
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: storageKey,
    ContentType: contentType,
  });
  const uploadUrl = await getSignedUrl(getS3(), command, { expiresIn: 300 });
  return { uploadUrl, publicUrl: `${R2_PUBLIC_URL}/${storageKey}`, storageKey };
}
```

Note: `PutObjectCommand` is already imported from `@aws-sdk/client-s3` at line 1.

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/storage.ts
git commit -m "feat: add createPresignedUploadUrl for direct-to-R2 file uploads"
```

---

### Task C3: Create upload-url API endpoint

**Files:** Create `app/api/projects/[id]/files/upload-url/route.ts`

- [ ] **Step 1: Create the endpoint file**

```tsx
import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/api-auth";
import { resolveProjectId } from "@/lib/project-utils";
import { createPresignedUploadUrl } from "@/lib/storage";
import { db } from "@/lib/db";
import { folders } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await params;
  const authResult = await authenticate(request, rawId);
  if (authResult instanceof Response) return authResult;

  const projectId = await resolveProjectId(rawId);
  if (!projectId) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const name = request.nextUrl.searchParams.get("name");
  const type = request.nextUrl.searchParams.get("type") ?? "application/octet-stream";
  const folderId = request.nextUrl.searchParams.get("folderId");

  if (!name) return NextResponse.json({ error: "Missing file name" }, { status: 400 });

  let folderPath = "files";
  if (folderId) {
    const [folder] = await db
      .select()
      .from(folders)
      .where(and(eq(folders.id, folderId), eq(folders.projectId, projectId)))
      .limit(1);
    if (!folder) return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    folderPath = folder.name.replace(/\.\.|\//g, "_");
  }

  try {
    const { uploadUrl, publicUrl, storageKey } = await createPresignedUploadUrl(
      projectId, folderPath, name, type,
    );
    return NextResponse.json({ uploadUrl, publicUrl, storageKey });
  } catch (err) {
    console.error("Failed to create presigned URL:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to create upload URL" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/projects/\[id\]/files/upload-url/route.ts
git commit -m "feat: add presigned URL endpoint for direct R2 uploads"
```

---

### Task C4: Update files POST route to accept JSON metadata

**Files:** Modify `app/api/projects/[id]/files/route.ts`

- [ ] **Step 1: Update POST handler**

Replace the existing POST function (lines 52-111). The new version accepts JSON metadata instead of FormData with binary files, since the actual upload went directly to R2:

```tsx
const postFileSchema = z.object({
  storageKey: z.string().min(1),
  name: z.string().min(1),
  size: z.number().positive(),
  mimeType: z.string(),
  folderId: z.string().nullable().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await params;
  const authResult = await authenticate(request, rawId);
  if (authResult instanceof Response) return authResult;

  const projectId = await resolveProjectId(rawId);
  if (!projectId) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = postFileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const { storageKey, name, size, mimeType, folderId } = parsed.data;

  if (folderId) {
    const [folder] = await db
      .select()
      .from(folders)
      .where(and(eq(folders.id, folderId), eq(folders.projectId, projectId)))
      .limit(1);
    if (!folder) return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  }

  const [record] = await db
    .insert(files)
    .values({
      projectId,
      folderId: folderId ?? null,
      name,
      size,
      mimeType,
      storageKey,
      uploadedBy: authResult.userId,
    })
    .returning({ id: files.id, uploadedAt: files.uploadedAt });

  if (record) {
    createNotifications({
      type: "new_file",
      referenceId: record.id,
      referenceType: "file",
      projectId,
      actorUserId: authResult.userId,
    }).catch((e) => console.error("Notification creation failed:", e));
  }

  return NextResponse.json({ file: { id: record?.id, name, size, mimeType, folderId: folderId ?? null, uploadedAt: record?.uploadedAt } }, { status: 201 });
}
```

Also add the zod import at top if not already present:
```tsx
import { z } from "zod";
```

Remove the `uploadFile` and `getMaxFileSize` imports from `@/lib/storage` since they're no longer needed in this route. Keep `detectMimeType` if still used by GET.

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/projects/\[id\]/files/route.ts
git commit -m "refactor: accept JSON metadata in files POST instead of FormData binary"
```

---

### Task C5: Update UploadZone for direct R2 upload

**Files:** Modify `components/files/UploadZone.tsx`

- [ ] **Step 1: Replace upload logic**

Replace the `handleUpload` function (lines 42-58) with direct-to-R2 logic:

```tsx
const handleUpload = async () => {
  if (selectedFiles.length === 0) return;
  setUploading(true);
  setError("");

  for (let i = 0; i < selectedFiles.length; i++) {
    const file = selectedFiles[i];
    try {
      // Step 1: Get presigned URL
      const urlParams = new URLSearchParams({ name: file.name, type: file.type });
      if (folderId) urlParams.set("folderId", folderId);
      const presignedRes = await fetch(
        `/api/projects/${projectId}/files/upload-url?${urlParams}`,
      );
      if (!presignedRes.ok) {
        const errData = await presignedRes.json().catch(() => ({}));
        throw new Error(errData.error ?? "Failed to get upload URL");
      }
      const { uploadUrl, storageKey } = await presignedRes.json();

      // Step 2: Upload directly to R2
      const r2Res = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "application/octet-stream" },
      });
      if (!r2Res.ok) {
        throw new Error(`Upload to storage failed (${r2Res.status})`);
      }

      // Step 3: Register file in DB
      const dbRes = await fetch(`/api/projects/${projectId}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storageKey,
          name: file.name,
          size: file.size,
          mimeType: file.type || "application/octet-stream",
          folderId: folderId ?? null,
        }),
      });
      if (!dbRes.ok) {
        const errData = await dbRes.json().catch(() => ({}));
        throw new Error(errData.error ?? "Failed to register file");
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? `${file.name}: ${err.message}`
          : `${file.name}: Upload failed`,
      );
      setUploading(false);
      return;
    }
  }

  setUploading(false);
  onComplete();
};
```

- [ ] **Step 2: Remove unused imports**

Remove `getMaxFileSize` and `SIZE_LIMITS` imports (line 2) — file size validation is now handled by the upload-url endpoint or can stay as client-side pre-check. Keep them for now for the drag-over size check. Actually, keep them since the `addFiles` function uses them for client-side validation.

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/files/UploadZone.tsx
git commit -m "feat: direct-to-R2 upload via presigned URLs with per-file error reporting"
```

---

### Task C6: Add inline audio player controls to FileList

**Files:** Modify `components/files/FileList.tsx`

- [ ] **Step 1: Add audio state variables**

In the `FileList` component, add new state variables after existing ones (after line 46):

```tsx
const [audioCurrentTime, setAudioCurrentTime] = useState(0);
const [audioDuration, setAudioDuration] = useState(0);
const [audioVolume, setAudioVolume] = useState(1);
const animationRef = useRef<number | null>(null);
```

- [ ] **Step 2: Update handlePlayAudio to set up time tracking**

Replace the `onCanPlay` handler (line 113-115) to also track duration and time:

```tsx
const onCanPlay = () => {
  setAudioLoading(false);
  setAudioDuration(audio.duration || 0);
  const updateTime = () => {
    setAudioCurrentTime(audio.currentTime);
    animationRef.current = requestAnimationFrame(updateTime);
  };
  animationRef.current = requestAnimationFrame(updateTime);
};
```

- [ ] **Step 3: Add cleanup for animation frame**

In the existing useEffect cleanup (after line 141), add:
```tsx
if (animationRef.current) cancelAnimationFrame(animationRef.current);
```

- [ ] **Step 4: Add seek handler and volume handler**

Add these functions after `handlePlayAudio`:

```tsx
const handleSeek = (time: number) => {
  if (audioRef.current) {
    audioRef.current.currentTime = time;
    setAudioCurrentTime(time);
  }
};

const handleVolumeChange = (vol: number) => {
  setAudioVolume(vol);
  if (audioRef.current) audioRef.current.volume = vol;
};

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
```

- [ ] **Step 5: Replace play button with inline control bar**

Replace the play button in the table (lines 216-224) with:

```tsx
{file.mimeType.startsWith("audio/") && (
  <div className="flex items-center gap-2">
    <Button
      variant={playingFileId === file.id ? "primary" : "ghost"}
      size="sm"
      onClick={() => handlePlayAudio(file.id, `/api/projects/${projectId}/files/${file.id}?inline=1`, file.mimeType)}
    >
      {playingFileId === file.id && audioLoading ? "..." : playingFileId === file.id ? "⏸" : "▶"}
    </Button>
    {playingFileId === file.id && !audioLoading && (
      <div className="flex items-center gap-1.5 bg-[#0F0F13] border border-white/5 rounded px-2 py-1">
        <span className="text-[10px] text-[#F0F0F0] font-mono tabular-nums min-w-[28px]">
          {formatTime(audioCurrentTime)}
        </span>
        <input
          type="range"
          min={0}
          max={audioDuration || 0}
          step={0.1}
          value={audioCurrentTime}
          onChange={(e) => handleSeek(parseFloat(e.target.value))}
          className="w-20 h-1 appearance-none bg-white/10 rounded-full outline-none cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5
            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#00F0FF]"
        />
        <span className="text-[10px] text-[#A0A0B0] font-mono tabular-nums min-w-[28px]">
          {formatTime(audioDuration)}
        </span>
        <button
          onClick={() => handleVolumeChange(audioVolume === 0 ? 1 : 0)}
          className="text-[10px] text-[#A0A0B0] hover:text-[#F0F0F0]"
        >
          {audioVolume === 0 ? "🔇" : audioVolume < 0.5 ? "🔉" : "🔊"}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={audioVolume}
          onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
          className="w-12 h-1 appearance-none bg-white/10 rounded-full outline-none cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5
            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#00F0FF]"
        />
      </div>
    )}
  </div>
)}
```

- [ ] **Step 6: Add file name click to open modal player**

Add an `onOpenModal` prop and make file names clickable. Add the prop to the `FileListProps` interface:

```tsx
interface FileListProps {
  files: FileItem[];
  loading: boolean;
  projectId: string;
  onDelete: (fileId: string) => void;
  onDownload: (fileId: string, fileName: string) => void;
  onOpenPlayer?: (file: FileItem) => void;
}
```

Update the file name span (line 207) to be clickable for audio files:

```tsx
<span
  className={`text-[#F0F0F0] truncate max-w-[200px] ${file.mimeType.startsWith("audio/") ? "cursor-pointer hover:text-[#00F0FF] hover:underline transition-colors" : ""}`}
  onClick={() => {
    if (file.mimeType.startsWith("audio/") && onOpenPlayer) {
      onOpenPlayer(file);
    }
  }}
>
  {file.name}
</span>
```

- [ ] **Step 7: Update FileBrowser to pass onOpenPlayer**

In `FileBrowser.tsx`, add state for the modal player and pass the prop. After the `showCreateFolder` state:

```tsx
const [playerFile, setPlayerFile] = useState<FileItem | null>(null);
```

Add import:
```tsx
import { AudioPlayerModal } from "./AudioPlayerModal";
```

Update the FileList call to pass onOpenPlayer:
```tsx
<FileList ... onOpenPlayer={(file) => setPlayerFile(file)} />
```

At the bottom of the return (before closing `</div>`), add:
```tsx
{playerFile && (
  <AudioPlayerModal
    file={playerFile}
    projectId={projectId}
    onClose={() => setPlayerFile(null)}
  />
)}
```

- [ ] **Step 8: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors from FileList. May show error for AudioPlayerModal which we create next — that's expected.

- [ ] **Step 9: Commit (partial — will commit with next task)**

Wait to commit until Task C7 (AudioPlayerModal) is also done.

---

### Task C7: Create AudioPlayerModal component

**Files:** Create `components/files/AudioPlayerModal.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Modal } from "@/components/ui/Modal";
import type { FileItem } from "./types";

interface AudioPlayerModalProps {
  file: FileItem;
  projectId: string;
  onClose: () => void;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}

export function AudioPlayerModal({ file, projectId, onClose }: AudioPlayerModalProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  const fileUrl = `/api/projects/${projectId}/files/${file.id}?inline=1`;

  const cleanup = useCallback(() => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
  }, []);

  useEffect(() => {
    const audio = new Audio(fileUrl);
    audio.preload = "auto";
    audio.volume = volume;
    audioRef.current = audio;

    audio.addEventListener("canplay", () => {
      setLoading(false);
      setDuration(audio.duration || 0);
    });
    audio.addEventListener("ended", () => setPlaying(false));
    audio.addEventListener("error", () => {
      setError("Playback failed");
      setLoading(false);
    });

    const updateTime = () => {
      if (audioRef.current) {
        setCurrentTime(audioRef.current.currentTime);
        animationRef.current = requestAnimationFrame(updateTime);
      }
    };
    audio.addEventListener("play", () => {
      setPlaying(true);
      animationRef.current = requestAnimationFrame(updateTime);
    });
    audio.addEventListener("pause", () => {
      setPlaying(false);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    });

    audio.play().catch(() => { setLoading(false); });

    return cleanup;
  }, [fileUrl, cleanup]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => setError("Playback failed"));
    }
  };

  const handleSeek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolume = (vol: number) => {
    setVolume(vol);
    if (audioRef.current) audioRef.current.volume = vol;
  };

  return (
    <Modal open onClose={() => { cleanup(); onClose(); }} title="Audio Player">
      <div className="space-y-4 py-4">
        <div className="text-center">
          <p className="text-sm text-[#F0F0F0] font-medium truncate">{file.name}</p>
          <p className="text-[10px] text-[#A0A0B0]">
            {file.mimeType} &middot; {formatSize(file.size)}
          </p>
        </div>

        {error && (
          <p className="text-xs text-[#FF4444] text-center">{error}</p>
        )}

        {loading && (
          <p className="text-xs text-[#A0A0B0] text-center">Loading audio...</p>
        )}

        <div className="space-y-3">
          {/* Progress bar */}
          <div className="space-y-1">
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={currentTime}
              onChange={(e) => handleSeek(parseFloat(e.target.value))}
              disabled={loading}
              className="w-full h-1.5 appearance-none bg-white/10 rounded-full outline-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#00F0FF]"
            />
            <div className="flex justify-between">
              <span className="text-[10px] text-[#A0A0B0] font-mono">{formatTime(currentTime)}</span>
              <span className="text-[10px] text-[#A0A0B0] font-mono">{formatTime(duration)}</span>
            </div>
          </div>

          {/* Play/Pause button */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={togglePlay}
              disabled={loading}
              className="w-12 h-12 rounded-full bg-[#00F0FF]/15 border-2 border-[#00F0FF]/30 flex items-center justify-center text-[#00F0FF] text-lg hover:bg-[#00F0FF]/25 transition-colors disabled:opacity-30"
            >
              {playing ? "⏸" : "▶"}
            </button>
          </div>

          {/* Volume */}
          <div className="flex items-center gap-2 justify-center">
            <button
              onClick={() => handleVolume(volume === 0 ? 1 : 0)}
              className="text-sm text-[#A0A0B0] hover:text-[#F0F0F0]"
            >
              {volume === 0 ? "🔇" : volume < 0.5 ? "🔉" : "🔊"}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => handleVolume(parseFloat(e.target.value))}
              className="w-24 h-1 appearance-none bg-white/10 rounded-full outline-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5
                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#00F0FF]"
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit all file system changes**

```bash
git add components/files/FileList.tsx components/files/AudioPlayerModal.tsx components/files/FileBrowser.tsx
git commit -m "feat: add inline audio player controls and modal player for Project Files"
```

---

## Final: VST3 Plugin Build (after all 3 branches merged to dev)

### Task V1: Build VST3 plugin

**Files:** `vst-plugin/build/` (output only)

- [ ] **Step 1: Ensure all branches are merged to dev**

```bash
git checkout dev && git pull origin dev
```

- [ ] **Step 2: Run CMake build**

```bash
cd vst-plugin
cmake -B build -G "Visual Studio 17 2022"
cmake --build build --config Release
```

- [ ] **Step 3: Verify output**

```bash
ls "vst-plugin/build/SonicBridge_artefacts/Release/VST3/SonicBridge.vst3"
```

Expected: File exists. Done.

---

## Diff Summary for Each Branch

### fix/discussion-ai
```
package.json                                          |   2 +-
package-lock.json                                     |  (auto)
components/discussion/PostForm.tsx                    |  60 ++--
components/discussion/ThreadCard.tsx                  | 180 ++++-------
components/discussion/DiscussionBoard.tsx             |   1 +
```
~5 commits, ~4 files modified

### fix/ui-quick-fixes
```
components/NotificationBell.tsx                       |   2 +-
components/CreativeSpaceStatus.tsx                    |  55 +++ (new)
app/api/projects/[id]/space/status/route.ts           |  55 +++ (new)
app/(dashboard)/projects/[id]/page.tsx                |  40 +--
components/space/AudioMixer.tsx                       |   2 +-
```
~3 commits, ~5 files (2 new)

### feat/file-system
```
package.json                                          |   1 +
package-lock.json                                     |  (auto)
lib/storage.ts                                        |  15 ++
app/api/projects/[id]/files/upload-url/route.ts       |  52 +++ (new)
app/api/projects/[id]/files/route.ts                  |  50 +--
components/files/UploadZone.tsx                       |  55 ++--
components/files/FileList.tsx                         |  80 ++++-
components/files/FileBrowser.tsx                      |  10 +
components/files/AudioPlayerModal.tsx                 | 160 +++++++ (new)
```
~6 commits, ~9 files (2 new)
