"use client";

import { useRef, useState } from "react";
import { gql } from "@apollo/client";
import { useMutation, useLazyQuery } from "@apollo/client/react";
import {
  File,
  FileText,
  Image,
  Lock,
  Loader2,
  Paperclip,
  Trash2,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

// ---------------------------------------------------------------------------
// GraphQL operations
// ---------------------------------------------------------------------------

const UPLOAD_ATTACHMENT = gql`
  mutation UploadAttachment(
    $taskId: String!
    $fileName: String!
    $fileSize: Int!
    $mimeType: String!
    $fileBase64: String!
  ) {
    uploadAttachment(
      taskId: $taskId
      fileName: $fileName
      fileSize: $fileSize
      mimeType: $mimeType
      fileBase64: $fileBase64
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
}: TaskAttachmentsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [uploadAttachment] = useMutation<{
    uploadAttachment: Attachment;
  }>(UPLOAD_ATTACHMENT, {
    update(cache, { data }) {
      if (!data?.uploadAttachment) return;
      cache.modify({
        id: cache.identify({ __typename: "Task", id: taskId }),
        fields: {
          attachments(existing = []) {
            const newRef = cache.writeFragment({
              data: data.uploadAttachment,
              fragment: gql`
                fragment NewAttachment on Attachment {
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
      cache.evict({ id: cache.identify({ __typename: "Attachment", id: attachmentId }) });
      cache.gc();
    },
  });

  const [fetchDownloadUrl] = useLazyQuery<{ attachmentDownloadUrl: string }>(
    ATTACHMENT_DOWNLOAD_URL,
    { fetchPolicy: "network-only" },
  );

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be selected again
    e.target.value = "";

    if (file.size > MAX_FILE_SIZE) {
      setError(fileTooLargeLabel);
      return;
    }

    setError(null);
    setUploading(true);

    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          // Strip data URL prefix (e.g. "data:image/png;base64,")
          const base64Data = result.split(",")[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      await uploadAttachment({
        variables: {
          taskId,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || "application/octet-stream",
          fileBase64: base64,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("storage") || message.includes("limit")) {
        setError(storageFullLabel);
      } else {
        setError(message || "Upload failed");
      }
    } finally {
      setUploading(false);
    }
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
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleDelete(attachment.id)}
                      title={deleteLabel}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <Lock className="text-muted-foreground h-3 w-3 shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Upload button / Premium CTA */}
      {isPremium ? (
        <>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileSelect}
          />
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground h-8 w-full justify-start gap-2 px-2"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Paperclip className="h-4 w-4" />
            )}
            {uploadLabel}
          </Button>
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
