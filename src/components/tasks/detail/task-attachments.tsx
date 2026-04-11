"use client";

import { useCallback, useRef, useState } from "react";
import { gql } from "@apollo/client";
import { useMutation, useLazyQuery } from "@apollo/client/react";
import { File, FileText, Image, Lock, Paperclip, Trash2, Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

// ---------------------------------------------------------------------------
// GraphQL operations
// ---------------------------------------------------------------------------

const REGISTER_ATTACHMENT = gql`
  mutation RegisterAttachment(
    $taskId: String!
    $fileName: String!
    $fileSize: Int!
    $mimeType: String!
    $blobUrl: String!
  ) {
    registerAttachment(
      taskId: $taskId
      fileName: $fileName
      fileSize: $fileSize
      mimeType: $mimeType
      blobUrl: $blobUrl
    ) {
      id
      taskId
      fileName
      fileSize
      mimeType
      createdAt
    }
  }
`;

const DELETE_ATTACHMENT = gql`
  mutation DeleteAttachment($id: String!) {
    deleteAttachment(id: $id)
  }
`;

const ATTACHMENT_DOWNLOAD_URL = gql`
  query AttachmentDownloadUrl($id: String!) {
    attachmentDownloadUrl(id: $id)
  }
`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Attachment {
  id: string;
  taskId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
}

interface UploadingFile {
  name: string;
  progress: number;
  status: "uploading" | "done" | "error";
  error?: string;
}

interface TaskAttachmentsProps {
  taskId: string;
  attachments: Attachment[];
  isPremium: boolean;
  uploadLabel: string;
  deleteLabel: string;
  downloadLabel: string;
  premiumRequiredLabel: string;
  premiumRequiredDesc: string;
  fileTooLargeLabel: string;
  storageFullLabel: string;
  dragDropHintLabel: string;
  uploadingLabel: string;
  deleteConfirmTitle: string;
  deleteConfirmDesc: string;
  deleteConfirmCancel: string;
  deleteConfirmAction: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string): LucideIcon {
  if (mimeType.startsWith("image/")) return Image;
  if (mimeType === "application/pdf") return FileText;
  return File;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TaskAttachments({
  taskId,
  attachments,
  isPremium,
  uploadLabel,
  deleteLabel,
  downloadLabel,
  premiumRequiredLabel,
  premiumRequiredDesc,
  fileTooLargeLabel,
  storageFullLabel,
  dragDropHintLabel,
  uploadingLabel,
  deleteConfirmTitle,
  deleteConfirmDesc,
  deleteConfirmCancel,
  deleteConfirmAction,
}: TaskAttachmentsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const [registerAttachment] = useMutation<{
    registerAttachment: Attachment;
  }>(REGISTER_ATTACHMENT, {
    update(cache, { data }) {
      if (!data?.registerAttachment) return;
      cache.modify({
        id: cache.identify({ __typename: "Task", id: taskId }),
        fields: {
          attachments(existing = []) {
            const newRef = cache.writeFragment({
              data: data.registerAttachment,
              fragment: gql`
                fragment NewAttachment on TaskAttachment {
                  id
                  taskId
                  fileName
                  fileSize
                  mimeType
                  createdAt
                }
              `,
            });
            return [...existing, newRef];
          },
        },
      });
    },
  });

  const [deleteAttachment] = useMutation<{ deleteAttachment: boolean }>(DELETE_ATTACHMENT, {
    update(cache, _result, { variables }) {
      if (!variables?.id) return;
      const attachmentId = variables.id as string;
      cache.modify({
        id: cache.identify({ __typename: "Task", id: taskId }),
        fields: {
          attachments(existing = [], { readField }) {
            return existing.filter(
              (ref: { __ref: string }) => readField("id", ref) !== attachmentId,
            );
          },
        },
      });
      cache.evict({ id: cache.identify({ __typename: "TaskAttachment", id: attachmentId }) });
      cache.gc();
    },
  });

  const [fetchDownloadUrl] = useLazyQuery<{ attachmentDownloadUrl: string }>(
    ATTACHMENT_DOWNLOAD_URL,
    { fetchPolicy: "network-only" },
  );

  const updateFileProgress = useCallback((fileName: string, progress: number) => {
    setUploadingFiles((prev) => prev.map((f) => (f.name === fileName ? { ...f, progress } : f)));
  }, []);

  const markFileDone = useCallback((fileName: string) => {
    setUploadingFiles((prev) =>
      prev.map((f) => (f.name === fileName ? { ...f, status: "done" as const, progress: 100 } : f)),
    );
    // Remove from list after a short delay
    setTimeout(() => {
      setUploadingFiles((prev) => prev.filter((f) => f.name !== fileName));
    }, 1000);
  }, []);

  const markFileError = useCallback((fileName: string, errorMessage: string) => {
    setUploadingFiles((prev) =>
      prev.map((f) =>
        f.name === fileName ? { ...f, status: "error" as const, error: errorMessage } : f,
      ),
    );
    // Remove from list after a delay so user can see the error
    setTimeout(() => {
      setUploadingFiles((prev) => prev.filter((f) => f.name !== fileName));
    }, 5000);
  }, []);

  async function uploadFile(file: globalThis.File) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("taskId", taskId);

    const { blobUrl } = await new Promise<{ blobUrl: string }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          updateFileProgress(file.name, (e.loaded / e.total) * 100);
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          try {
            const err = JSON.parse(xhr.responseText);
            reject(new Error(err.error || "Upload failed"));
          } catch {
            reject(new Error("Upload failed"));
          }
        }
      });

      xhr.addEventListener("error", () => reject(new Error("Upload failed")));

      xhr.open("POST", "/api/upload");
      xhr.send(formData);
    });

    // Register in DB via GraphQL (preserves existing Apollo cache update)
    await registerAttachment({
      variables: {
        taskId,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || "application/octet-stream",
        blobUrl,
      },
    });
  }

  async function handleFiles(files: globalThis.File[]) {
    setError(null);

    // Filter out files that are too large
    const validFiles: globalThis.File[] = [];
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        setError(fileTooLargeLabel);
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    // Add all files to uploading state
    setUploadingFiles((prev) => [
      ...prev,
      ...validFiles.map((f) => ({
        name: f.name,
        progress: 0,
        status: "uploading" as const,
      })),
    ]);

    // Upload all files concurrently
    await Promise.all(
      validFiles.map(async (file) => {
        try {
          await uploadFile(file);
          markFileDone(file.name);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Upload failed";
          if (message.includes("storage") || message.includes("limit")) {
            setError(storageFullLabel);
          }
          markFileError(file.name, message);
        }
      }),
    );
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    // Copy files BEFORE resetting input (FileList is a live object)
    const files = Array.from(fileList);

    // Reset input so same file can be selected again
    e.target.value = "";

    await handleFiles(files);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    await handleFiles(files);
  }

  async function handleDownload(attachmentId: string) {
    try {
      const { data } = await fetchDownloadUrl({ variables: { id: attachmentId } });
      if (data?.attachmentDownloadUrl) {
        window.open(data.attachmentDownloadUrl, "_blank");
      }
    } catch {
      // silently fail
    }
  }

  function handleDelete(attachmentId: string) {
    deleteAttachment({ variables: { id: attachmentId } });
  }

  const isUploading = uploadingFiles.some((f) => f.status === "uploading");

  // Nothing to show for free users with no attachments
  if (!isPremium && attachments.length === 0) return null;

  return (
    <div className="space-y-2">
      {/* Attachment list */}
      {attachments.length > 0 && (
        <div className="space-y-1">
          {attachments.map((attachment) => {
            const Icon = getFileIcon(attachment.mimeType);
            return (
              <div
                key={attachment.id}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                  !isPremium && "opacity-50",
                )}
              >
                <Icon className="text-muted-foreground h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{attachment.fileName}</span>
                <span className="text-muted-foreground shrink-0 text-xs">
                  {formatFileSize(attachment.fileSize)}
                </span>
                {isPremium ? (
                  <div className="flex shrink-0 items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleDownload(attachment.id)}
                      title={downloadLabel}
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6" title={deleteLabel}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{deleteConfirmTitle}</AlertDialogTitle>
                          <AlertDialogDescription>{deleteConfirmDesc}</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{deleteConfirmCancel}</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => handleDelete(attachment.id)}
                          >
                            {deleteConfirmAction}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ) : (
                  <Lock className="text-muted-foreground h-3 w-3 shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Upload area / Premium CTA */}
      {isPremium ? (
        <>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />

          {/* Drag & drop zone */}
          <div
            role="button"
            tabIndex={0}
            aria-label={uploadLabel}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed px-3 py-4 text-center transition-colors",
              isDragOver
                ? "border-primary bg-primary/5 text-primary"
                : "border-muted-foreground/25 text-muted-foreground hover:border-muted-foreground/50",
              isUploading && "pointer-events-none opacity-60",
            )}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {isUploading ? (
              <Upload className="h-5 w-5 animate-pulse" />
            ) : (
              <Paperclip className="h-5 w-5" />
            )}
            <span className="text-xs">{isUploading ? uploadingLabel : dragDropHintLabel}</span>
          </div>

          {/* Per-file progress bars */}
          {uploadingFiles.length > 0 && (
            <div className="space-y-1.5">
              {uploadingFiles.map((file) => (
                <div key={file.name} className="space-y-0.5 px-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="min-w-0 flex-1 truncate">{file.name}</span>
                    <span
                      className={cn(
                        "ml-2 shrink-0",
                        file.status === "error"
                          ? "text-red-500"
                          : file.status === "done"
                            ? "text-green-600"
                            : "text-muted-foreground",
                      )}
                    >
                      {file.status === "error"
                        ? file.error
                        : file.status === "done"
                          ? "100%"
                          : `${Math.round(file.progress)}%`}
                    </span>
                  </div>
                  <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-300",
                        file.status === "error"
                          ? "bg-red-500"
                          : file.status === "done"
                            ? "bg-green-600"
                            : "bg-primary",
                      )}
                      style={{ width: `${file.progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <a
          href="/settings"
          className="text-muted-foreground hover:text-foreground flex items-center gap-2 px-2 py-1 text-xs transition-colors"
        >
          <Lock className="h-3 w-3" />
          {premiumRequiredLabel} &mdash; {premiumRequiredDesc}
        </a>
      )}

      {/* Error message */}
      {error && <p className="px-2 text-xs text-red-500">{error}</p>}
    </div>
  );
}
