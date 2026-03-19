"use client";

import { useState } from "react";
import { gql } from "@apollo/client";
import { useQuery, useMutation } from "@apollo/client/react";
import { Link2, Share2, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useTranslations } from "@/lib/i18n";

// ---------------------------------------------------------------------------
// GraphQL operations
// ---------------------------------------------------------------------------

const GET_TASK_SHARES = gql`
  query GetTaskShares($taskId: String!) {
    taskShares(taskId: $taskId) {
      id
      sharedWith {
        id
        name
        email
        image
      }
      createdAt
    }
  }
`;

const GET_TASK_SHARE_SOURCE = gql`
  query GetTaskShareSource($taskId: String!) {
    taskShareSource(taskId: $taskId) {
      id
      owner {
        id
        name
        email
        image
      }
      createdAt
    }
  }
`;

const GET_CONNECTIONS = gql`
  query GetConnectionsForSharing {
    connections {
      id
      connectedUser {
        id
        name
        email
        image
      }
    }
  }
`;

const SHARE_TASK = gql`
  mutation ShareTask($taskId: String!, $targetUserId: String!) {
    shareTask(taskId: $taskId, targetUserId: $targetUserId)
  }
`;

const UNSHARE_TASK = gql`
  mutation UnshareTask($sharedTaskId: String!) {
    unshareTask(sharedTaskId: $sharedTaskId)
  }
`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ShareUser {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

interface SharedTaskInfo {
  id: string;
  sharedWith: ShareUser;
  createdAt: string;
}

interface IncomingShareInfo {
  id: string;
  owner: ShareUser;
  createdAt: string;
}

interface ConnectionEntry {
  id: string;
  connectedUser: ShareUser;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function UserAvatar({ user }: { user: ShareUser }) {
  if (user.image) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img src={user.image} alt={user.name ?? ""} className="h-7 w-7 rounded-full object-cover" />
    );
  }
  return (
    <div className="bg-muted flex h-7 w-7 items-center justify-center rounded-full">
      <UserRound className="text-muted-foreground h-4 w-4" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface TaskSharingProps {
  taskId: string;
}

export function TaskSharing({ taskId }: TaskSharingProps) {
  const { t } = useTranslations();
  const [pickerOpen, setPickerOpen] = useState(false);

  const { data: sharesData, refetch: refetchShares } = useQuery<{
    taskShares: SharedTaskInfo[];
  }>(GET_TASK_SHARES, {
    variables: { taskId },
    fetchPolicy: "cache-and-network",
  });

  const { data: sourceData } = useQuery<{
    taskShareSource: IncomingShareInfo | null;
  }>(GET_TASK_SHARE_SOURCE, {
    variables: { taskId },
    fetchPolicy: "cache-and-network",
  });

  const { data: connectionsData } = useQuery<{
    connections: ConnectionEntry[];
  }>(GET_CONNECTIONS, {
    fetchPolicy: "cache-and-network",
    skip: !pickerOpen,
  });

  const [shareTask, { loading: sharing }] = useMutation(SHARE_TASK);
  const [unshareTask] = useMutation(UNSHARE_TASK);

  const shares = sharesData?.taskShares ?? [];
  const shareSource = sourceData?.taskShareSource ?? null;
  const connections = connectionsData?.connections ?? [];

  // Users already shared with (by userId)
  const alreadySharedWithIds = new Set(shares.map((s) => s.sharedWith.id));

  // Connections not yet shared with
  const availableConnections = connections.filter(
    (c) => !alreadySharedWithIds.has(c.connectedUser.id),
  );

  async function handleShare(targetUserId: string) {
    await shareTask({ variables: { taskId, targetUserId } });
    await refetchShares();
    if (availableConnections.length <= 1) {
      setPickerOpen(false);
    }
  }

  async function handleUnshare(sharedTaskId: string) {
    await unshareTask({ variables: { sharedTaskId } });
    await refetchShares();
  }

  // ---- Participant view ----
  if (shareSource) {
    return (
      <div className="flex items-center gap-2 rounded-md bg-blue-500/10 px-3 py-2 text-sm text-blue-600 dark:text-blue-400">
        <Link2 className="h-4 w-4 shrink-0" />
        <span>
          {t("sharing.sharedFrom", {
            name: shareSource.owner.name ?? shareSource.owner.email ?? "?",
          })}
        </span>
      </div>
    );
  }

  // ---- Owner view ----
  return (
    <div className="space-y-1">
      {/* Existing shares */}
      {shares.map((share) => (
        <div key={share.id} className="flex items-center gap-2 rounded-md px-3 py-1">
          <Share2 className="text-muted-foreground h-4 w-4 shrink-0" />
          <UserAvatar user={share.sharedWith} />
          <span className="min-w-0 flex-1 truncate text-sm">
            {share.sharedWith.name ?? share.sharedWith.email ?? "?"}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => handleUnshare(share.id)}
            title={t("sharing.unshare")}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}

      {/* Share picker */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" className="w-full justify-start gap-2">
            <Share2 className="h-4 w-4" />
            {shares.length > 0 ? t("sharing.shareWithAnother") : t("sharing.shareWith")}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("sharing.shareWith")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1 py-2">
            {availableConnections.length === 0 && (
              <p className="text-muted-foreground px-1 py-2 text-sm">
                {t("sharing.noConnections")}
              </p>
            )}
            {availableConnections.map((conn) => (
              <button
                key={conn.id}
                disabled={sharing}
                onClick={() => handleShare(conn.connectedUser.id)}
                className="hover:bg-accent flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors disabled:opacity-50"
              >
                <UserAvatar user={conn.connectedUser} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {conn.connectedUser.name ?? conn.connectedUser.email ?? "?"}
                  </p>
                  {conn.connectedUser.email && conn.connectedUser.name && (
                    <p className="text-muted-foreground truncate text-xs">
                      {conn.connectedUser.email}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
