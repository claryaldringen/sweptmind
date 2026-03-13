export interface TaskAttachment {
  id: string;
  taskId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  blobUrl: string;
  createdAt: Date;
}

export interface CreateAttachmentInput {
  taskId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  blobUrl: string;
}
