## Summary
- Dual authentication (session cookie + API token Bearer sb_) via lib/api-auth.ts
- Local filesystem storage abstraction in lib/storage.ts (organized as storage/{projectId}/{folderPath}/)
- Folders API: GET list, POST create, DELETE (recursive with descendant cleanup)
- Files API: GET list (with folderId filter), POST upload (multipart, multi-file, 100MB limit), GET download, DELETE
- Full file manager frontend with cyberpunk theme: FileBrowser, FolderTree, FileList, BreadcrumbNav, UploadZone, CreateFolderModal
- Proxy middleware updated to allow API token requests through without session
- Replaced placeholder files page with functional FileBrowser
- Removed conflicting middleware.ts (Next.js 16 uses proxy.ts)

## Changes
| Action | File |
|--------|------|
| NEW | lib/api-auth.ts |
| NEW | lib/storage.ts |
| NEW | app/api/projects/[id]/folders/route.ts |
| NEW | app/api/projects/[id]/folders/[folderId]/route.ts |
| NEW | app/api/projects/[id]/files/route.ts |
| NEW | app/api/projects/[id]/files/[fileId]/route.ts |
| NEW | components/files/ (8 files) |
| MODIFY | proxy.ts |
| MODIFY | .gitignore |
| MODIFY | app/(dashboard)/projects/[id]/files/page.tsx |
| DELETE | middleware.ts |

## Test Plan
- npm run build passes
- Browser: upload files via drag-and-drop and click-to-browse
- Browser: download and delete files
- Browser: create and delete folders, navigate with folder tree and breadcrumbs
- API token: curl with Authorization header for list/upload/download/delete
- Edge cases: empty folders, large files (near 100MB), concurrent uploads