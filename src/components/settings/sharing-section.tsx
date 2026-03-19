"use client";

import { useState } from "react";
import { gql } from "@apollo/client";
import { useMutation, useQuery, useApolloClient } from "@apollo/client/react";
import { Users, Copy, Check, Link, X } from "lucide-react";
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
import { useTranslations } from "@/lib/i18n";

// ── GraphQL ──────────────────────────────────────────────────────────────────

const GET_CONNECTIONS = gql`
  query GetConnections {
    connections {
      id
      connectedUser {
        id
        name
        email
        image
      }
      targetList {
        id
        name
      }
      sharedTaskCount
      createdAt
    }
  }
`;

const GET_CONNECTION_INVITES = gql`
  query GetConnectionInvites {
    connectionInvites {
      id
      token
      status
      expiresAt
      createdAt
    }
  }
`;

const GET_SHARING_DEFAULT_LIST_ID = gql`
  query GetSharingDefaultListId {
    sharingDefaultListId
  }
`;

const CREATE_CONNECTION_INVITE = gql`
  mutation CreateConnectionInvite {
    createConnectionInvite {
      id
      token
      expiresAt
    }
  }
`;

const CANCEL_CONNECTION_INVITE = gql`
  mutation CancelConnectionInvite($inviteId: ID!) {
    cancelConnectionInvite(inviteId: $inviteId)
  }
`;

const DISCONNECT = gql`
  mutation Disconnect($connectedUserId: ID!) {
    disconnect(connectedUserId: $connectedUserId)
  }
`;

const UPDATE_CONNECTION_TARGET_LIST = gql`
  mutation UpdateConnectionTargetList($connectionId: ID!, $listId: ID) {
    updateConnectionTargetList(connectionId: $connectionId, listId: $listId)
  }
`;

const UPDATE_SHARING_DEFAULT_LIST = gql`
  mutation UpdateSharingDefaultList($listId: ID) {
    updateSharingDefaultList(listId: $listId)
  }
`;

// ── Types ────────────────────────────────────────────────────────────────────

interface ConnectedUser {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

interface TargetList {
  id: string;
  name: string;
}

interface Connection {
  id: string;
  connectedUser: ConnectedUser;
  targetList: TargetList | null;
  sharedTaskCount: number;
  createdAt: string;
}

interface ConnectionInvite {
  id: string;
  token: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

interface UserList {
  id: string;
  name: string;
  isDefault: boolean;
}

// ── Helper: Initials avatar ──────────────────────────────────────────────────

const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-green-500",
  "bg-purple-500",
  "bg-orange-500",
  "bg-pink-500",
  "bg-teal-500",
];

function getAvatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string | null, email: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email) return email[0].toUpperCase();
  return "?";
}

// ── Props ────────────────────────────────────────────────────────────────────

interface SharingSectionProps {
  userLists: UserList[];
}

// ── Component ────────────────────────────────────────────────────────────────

export function SharingSection({ userLists }: SharingSectionProps) {
  const { t } = useTranslations();
  const apolloClient = useApolloClient();

  const { data: connectionsData, refetch: refetchConnections } = useQuery<{
    connections: Connection[];
  }>(GET_CONNECTIONS);

  const { data: invitesData, refetch: refetchInvites } = useQuery<{
    connectionInvites: ConnectionInvite[];
  }>(GET_CONNECTION_INVITES);

  const { data: defaultListData } = useQuery<{ sharingDefaultListId: string | null }>(
    GET_SHARING_DEFAULT_LIST_ID,
  );

  const [createInvite, { loading: creatingInvite }] = useMutation<{
    createConnectionInvite: { id: string; token: string; expiresAt: string };
  }>(CREATE_CONNECTION_INVITE);

  const [cancelInvite] = useMutation(CANCEL_CONNECTION_INVITE);
  const [disconnect] = useMutation(DISCONNECT);
  const [updateConnectionTargetList] = useMutation(UPDATE_CONNECTION_TARGET_LIST);
  const [updateSharingDefaultList] = useMutation(UPDATE_SHARING_DEFAULT_LIST);

  const connections = connectionsData?.connections ?? [];
  const invites = (invitesData?.connectionInvites ?? []).filter((i) => i.status === "pending");
  const defaultListId = defaultListData?.sharingDefaultListId ?? null;

  // Copy state: key = invite token or "new"
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const getInviteUrl = (token: string) =>
    typeof window !== "undefined" ? `${window.location.origin}/invite/${token}` : `/invite/${token}`;

  const copyInviteLink = async (token: string, key: string) => {
    await navigator.clipboard.writeText(getInviteUrl(token));
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 2000);
  };

  const handleCreateInvite = async () => {
    const { data } = await createInvite();
    if (data?.createConnectionInvite) {
      await refetchInvites();
      await copyInviteLink(data.createConnectionInvite.token, data.createConnectionInvite.id);
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    await cancelInvite({ variables: { inviteId } });
    await refetchInvites();
  };

  const handleDisconnect = async (connectedUserId: string) => {
    await disconnect({ variables: { connectedUserId } });
    await refetchConnections();
  };

  const handleDefaultListChange = async (listId: string | null) => {
    apolloClient.cache.writeQuery({
      query: GET_SHARING_DEFAULT_LIST_ID,
      data: { sharingDefaultListId: listId },
    });
    await updateSharingDefaultList({ variables: { listId } });
  };

  const handleConnectionTargetListChange = async (connectionId: string, listId: string | null) => {
    await updateConnectionTargetList({ variables: { connectionId, listId } });
    await refetchConnections();
  };

  return (
    <div className="rounded-lg border p-5 md:col-span-2">
      <div className="mb-4 flex items-center gap-2">
        <Users className="h-5 w-5" />
        <div>
          <h2 className="text-lg font-semibold">{t("sharing.title")}</h2>
          <p className="text-muted-foreground text-sm">{t("sharing.description")}</p>
        </div>
      </div>

      {/* Global default list */}
      <div className="mb-5 flex items-center justify-between gap-4">
        <p className="text-sm font-medium">{t("sharing.defaultList")}</p>
        <select
          value={defaultListId ?? ""}
          onChange={(e) => handleDefaultListChange(e.target.value || null)}
          className="border-input bg-background ring-offset-background focus:ring-ring flex h-8 rounded-md border px-2 text-sm focus:ring-2 focus:ring-offset-2 focus:outline-none"
        >
          <option value="">{t("calendar.calendarTargetListPlaceholder")}</option>
          {userLists.map((list) => (
            <option key={list.id} value={list.id}>
              {list.name}
            </option>
          ))}
        </select>
      </div>

      {/* Create invite button */}
      <div className="mb-5">
        <Button
          variant="outline"
          className="gap-2"
          onClick={handleCreateInvite}
          disabled={creatingInvite}
        >
          <Link className="h-4 w-4" />
          {t("sharing.createInvite")}
        </Button>
      </div>

      {/* Pending invites */}
      {invites.length > 0 && (
        <div className="mb-5 space-y-2">
          {invites.map((invite) => {
            const expiresAt = new Date(invite.expiresAt);
            const daysUntilExpiry = Math.ceil(
              (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
            );
            const isCopied = copiedKey === invite.id;
            return (
              <div
                key={invite.id}
                className="flex items-center justify-between gap-3 rounded-md border p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{t("sharing.invitePending")}</p>
                  {daysUntilExpiry > 0 && (
                    <p className="text-muted-foreground text-xs">
                      {t("sharing.inviteExpires", { days: String(daysUntilExpiry) })}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyInviteLink(invite.token, invite.id)}
                    title={t("sharing.copyLink")}
                  >
                    {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleCancelInvite(invite.id)}
                    title={t("sharing.cancelInvite")}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Connected users */}
      {connections.length === 0 && invites.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("sharing.noConnections")}</p>
      ) : (
        <div className="space-y-3">
          {connections.map((connection) => {
            const { connectedUser } = connection;
            const avatarColor = getAvatarColor(connectedUser.id);
            const initials = getInitials(connectedUser.name, connectedUser.email);
            return (
              <div
                key={connection.id}
                className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                {/* Avatar + name/email */}
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ${avatarColor}`}
                  >
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {connectedUser.name ?? connectedUser.email ?? t("common.user")}
                    </p>
                    {connectedUser.name && connectedUser.email && (
                      <p className="text-muted-foreground truncate text-xs">
                        {connectedUser.email}
                      </p>
                    )}
                    <p className="text-muted-foreground text-xs">
                      {connection.sharedTaskCount} {t("sharing.sharedTasks")}
                    </p>
                  </div>
                </div>

                {/* Per-connection target list + disconnect */}
                <div className="flex shrink-0 items-center gap-2">
                  <select
                    value={connection.targetList?.id ?? ""}
                    onChange={(e) =>
                      handleConnectionTargetListChange(connection.id, e.target.value || null)
                    }
                    className="border-input bg-background ring-offset-background focus:ring-ring flex h-8 rounded-md border px-2 text-sm focus:ring-2 focus:ring-offset-2 focus:outline-none"
                  >
                    <option value="">{t("calendar.calendarTargetListPlaceholder")}</option>
                    {userLists.map((list) => (
                      <option key={list.id} value={list.id}>
                        {list.name}
                      </option>
                    ))}
                  </select>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-500 hover:text-red-600"
                      >
                        {t("sharing.disconnect")}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t("common.deleteConfirmTitle")}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t("sharing.disconnectConfirm")}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t("common.deleteConfirmCancel")}</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-red-500 hover:bg-red-600"
                          onClick={() => handleDisconnect(connectedUser.id)}
                        >
                          {t("sharing.disconnect")}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
