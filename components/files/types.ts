export interface Folder {
  id: string;
  projectId: string;
  name: string;
  parentId: string | null;
  createdBy: string;
  createdAt: string;
}

export interface FileItem {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  folderId: string | null;
  uploadedBy: string;
  uploaderName: string;
  uploadedAt: string;
}