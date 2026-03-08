"use client";

import { useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { gql } from "@apollo/client";
import { useQuery, useMutation } from "@apollo/client/react";
import { useLists, type ListItem } from "@/components/providers/lists-provider";
import { useDroppable } from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTaskDnd } from "@/components/providers/task-dnd-provider";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useTaskCountMode } from "@/hooks/use-task-count-mode";
import { useDeviceContext } from "@/hooks/use-device-context";
import { useTranslations } from "@/lib/i18n";
import { isFutureTask } from "@/domain/services/task-visibility";
import {
  CalendarDays,
  MapPin,
  Monitor,
  Pencil,
  Plus,
  Smartphone,
  Tag,
  Trash2,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getTagColorClasses } from "@/lib/tag-colors";
import { ListIcon, LIST_ICONS } from "@/lib/list-icons";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { CreateListDialog } from "@/components/lists/create-list-dialog";
import { useNearby } from "@/components/providers/nearby-provider";
import { useSidebarContext } from "@/components/layout/app-shell";
import { UserMenu } from "./user-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";

const GET_TAGS = gql`
  query GetTags {
    tags {
      id
      name
      color
      taskCount
      deviceContext
      locationId
      location {
        id
        name
        latitude
        longitude
      }
    }
  }
`;

const CONTEXT_TASKS_COUNT = gql`
  query ContextTasksCount($deviceContext: String, $nearbyLocationIds: [String!]) {
    contextTasks(deviceContext: $deviceContext, nearbyLocationIds: $nearbyLocationIds) {
      id
      isCompleted
      dueDate
      reminderAt
    }
  }
`;

const ALL_TASKS_WITH_LOCATION = gql`
  query AllTasksWithLocation {
    allTasksWithLocation {
      id
      location {
        id
        latitude
        longitude
      }
    }
  }
`;

const REORDER_LISTS = gql`
  mutation ReorderLists($input: [ReorderListInput!]!) {
    reorderLists(input: $input)
  }
`;

const UPDATE_LIST = gql`
  mutation UpdateList($id: String!, $input: UpdateListInput!) {
    updateList(id: $id, input: $input) {
      id
      name
      icon
    }
  }
`;

const DELETE_LIST = gql`
  mutation DeleteList($id: String!) {
    deleteList(id: $id)
  }
`;

const UPDATE_TAG = gql`
  mutation UpdateTag($id: String!, $input: UpdateTagInput!) {
    updateTag(id: $id, input: $input) {
      id
      name
    }
  }
`;

const DELETE_TAG = gql`
  mutation DeleteTag($id: String!) {
    deleteTag(id: $id)
  }
`;

interface TagItem {
  id: string;
  name: string;
  color: string;
  taskCount: number;
  deviceContext: string | null;
  locationId: string | null;
  location: { id: string; name: string; latitude: number; longitude: number } | null;
}

interface GetTagsData {
  tags: TagItem[];
}

function SortableListItem({
  list,
  isActive,
  taskCountMode,
  isNearby,
  isDeviceMatch,
  isDropTarget,
  onRename,
  onDelete,
  onNavigate,
}: {
  list: ListItem;
  isActive: boolean;
  taskCountMode: "all" | "visible";
  isNearby: boolean;
  isDeviceMatch: boolean;
  isDropTarget: boolean;
  onRename: (list: ListItem) => void;
  onDelete: (list: ListItem) => void;
  onNavigate?: () => void;
}) {
  const { t } = useTranslations();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: list.id,
    data: { type: "list" },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const count = taskCountMode === "visible" ? list.visibleTaskCount : list.taskCount;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(isDragging && "z-10")}
      {...attributes}
      {...listeners}
    >
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <Link
            href={`/lists/${list.id}`}
            onClick={onNavigate}
            className={cn(
              "hover:bg-sidebar-accent flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
              isDragging && "opacity-50",
              isNearby && "bg-emerald-50 dark:bg-emerald-950/30",
              isDeviceMatch && "bg-yellow-50 dark:bg-yellow-950/30",
              isDropTarget && "ring-primary bg-primary/10 ring-2",
            )}
          >
            <div className="flex items-center gap-3">
              <ListIcon icon={list.icon} className="h-5 w-5 text-blue-500" />
              <span className="truncate">{list.name}</span>
              {isNearby && <MapPin className="h-3 w-3 animate-pulse text-green-500" />}
              {isDeviceMatch &&
                !isNearby &&
                (list.deviceContext === "phone" ? (
                  <Smartphone className="h-3 w-3 animate-pulse text-yellow-500" />
                ) : (
                  <Monitor className="h-3 w-3 animate-pulse text-yellow-500" />
                ))}
            </div>
            {count > 0 && <span className="text-muted-foreground text-xs">{count}</span>}
          </Link>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => onRename(list)}>
            <Pencil className="h-4 w-4" />
            {t("lists.rename")}
          </ContextMenuItem>
          {!list.isDefault && (
            <ContextMenuItem variant="destructive" onClick={() => onDelete(list)}>
              <Trash2 className="h-4 w-4" />
              {t("lists.delete")}
            </ContextMenuItem>
          )}
        </ContextMenuContent>
      </ContextMenu>
    </div>
  );
}

function DroppableDefaultList({
  list,
  isActive,
  contextCount,
  isDropTarget,
  onNavigate,
}: {
  list: ListItem;
  isActive: boolean;
  contextCount: number;
  isDropTarget: boolean;
  onNavigate?: () => void;
}) {
  const { t } = useTranslations();
  const { setNodeRef } = useDroppable({
    id: list.id,
    data: { type: "list" },
  });

  return (
    <div ref={setNodeRef}>
      <Link
        href="/context"
        onClick={onNavigate}
        className={cn(
          "hover:bg-sidebar-accent flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
          isDropTarget && "ring-primary bg-primary/10 ring-2",
        )}
      >
        <div className="flex items-center gap-3">
          <Zap className="h-5 w-5 text-yellow-500" />
          {t("sidebar.tasks")}
        </div>
        {contextCount > 0 && <span className="text-muted-foreground text-xs">{contextCount}</span>}
      </Link>
    </div>
  );
}

function SidebarTagItem({
  tag,
  isActive,
  isNearby,
  isDeviceMatch,
  onRename,
  onDelete,
  onNavigate,
}: {
  tag: TagItem;
  isActive: boolean;
  isNearby: boolean;
  isDeviceMatch: boolean;
  onRename: (tag: TagItem) => void;
  onDelete: (tag: TagItem) => void;
  onNavigate?: () => void;
}) {
  const { t } = useTranslations();
  const colors = getTagColorClasses(tag.color);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <Link
          href={`/tags/${tag.id}`}
          onClick={onNavigate}
          className={cn(
            "hover:bg-sidebar-accent flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
            isNearby && "bg-emerald-50 dark:bg-emerald-950/30",
            isDeviceMatch && !isNearby && "bg-yellow-50 dark:bg-yellow-950/30",
          )}
        >
          <div className="flex items-center gap-3">
            <Tag className={cn("h-5 w-5", colors.text)} />
            <span className="truncate">{tag.name}</span>
            {isNearby && <MapPin className="h-3 w-3 animate-pulse text-green-500" />}
            {isDeviceMatch &&
              !isNearby &&
              (tag.deviceContext === "phone" ? (
                <Smartphone className="h-3 w-3 animate-pulse text-yellow-500" />
              ) : (
                <Monitor className="h-3 w-3 animate-pulse text-yellow-500" />
              ))}
          </div>
          {tag.taskCount > 0 && (
            <span className="text-muted-foreground text-xs">{tag.taskCount}</span>
          )}
        </Link>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => onRename(tag)}>
          <Pencil className="h-4 w-4" />
          {t("tags.rename")}
        </ContextMenuItem>
        <ContextMenuItem variant="destructive" onClick={() => onDelete(tag)}>
          <Trash2 className="h-4 w-4" />
          {t("tags.delete")}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

const SMART_LIST_ORDER_KEY = "sweptmind-smart-list-order";
const DEFAULT_SMART_ORDER = ["planned", "nearby", "context"];

function getStoredSmartOrder(): string[] {
  if (typeof window === "undefined") return DEFAULT_SMART_ORDER;
  try {
    const stored = localStorage.getItem(SMART_LIST_ORDER_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as string[];
      if (Array.isArray(parsed) && parsed.length === DEFAULT_SMART_ORDER.length) return parsed;
    }
  } catch { /* ignore */ }
  return DEFAULT_SMART_ORDER;
}

function SortableSmartItem({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: { type: "smart-list" },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className={cn(isDragging && "z-10 opacity-50")} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

export function Sidebar() {
  const { close: closeSidebar } = useSidebarContext();
  useKeyboardShortcuts();
  const { mode: taskCountMode } = useTaskCountMode();
  const deviceContext = useDeviceContext();
  const { t } = useTranslations();
  const pathname = usePathname();
  const router = useRouter();
  const { lists: allLists } = useLists();
  const { data: tagsData } = useQuery<GetTagsData>(GET_TAGS);
  const [reorderLists] = useMutation(REORDER_LISTS);
  const [createListOpen, setCreateListOpen] = useState(false);
  const [localOrder, setLocalOrder] = useState<ListItem[] | null>(null);
  const { isNearby: checkNearby, isTracking, nearbyLocationIds } = useNearby();
  const [smartOrder, setSmartOrder] = useState(getStoredSmartOrder);
  const { data: contextCountData } = useQuery<{
    contextTasks: {
      id: string;
      isCompleted: boolean;
      dueDate: string | null;
      reminderAt: string | null;
    }[];
  }>(CONTEXT_TASKS_COUNT, {
    variables: { deviceContext, nearbyLocationIds: nearbyLocationIds ?? [] },
  });
  const contextTaskCount =
    contextCountData?.contextTasks?.filter((t) => !isFutureTask(t)).length ?? 0;
  const { data: nearbyData } = useQuery<{
    allTasksWithLocation: {
      id: string;
      location: { id: string; latitude: number; longitude: number } | null;
    }[];
  }>(ALL_TASKS_WITH_LOCATION, { skip: !isTracking });
  const { registerListReorder, registerSmartListReorder, overListId, activeType } = useTaskDnd();

  // List rename/delete state
  const [renameListTarget, setRenameListTarget] = useState<ListItem | null>(null);
  const [renameListValue, setRenameListValue] = useState("");
  const [renameListIcon, setRenameListIcon] = useState<string>("list");
  const [deleteListTarget, setDeleteListTarget] = useState<ListItem | null>(null);
  const [updateList] = useMutation(UPDATE_LIST);
  const [deleteList] = useMutation(DELETE_LIST);

  // Tag rename/delete state
  const [renameTagTarget, setRenameTagTarget] = useState<TagItem | null>(null);
  const [renameTagValue, setRenameTagValue] = useState("");
  const [deleteTagTarget, setDeleteTagTarget] = useState<TagItem | null>(null);
  const [updateTag] = useMutation(UPDATE_TAG);
  const [deleteTag] = useMutation(DELETE_TAG);

  const nearbyCount = isTracking
    ? (nearbyData?.allTasksWithLocation ?? []).filter(
        (task) => task.location && checkNearby(task.location.latitude, task.location.longitude),
      ).length
    : 0;

  const serverCustomLists = allLists
    .filter((l: ListItem) => !l.isDefault)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const customLists = localOrder ?? serverCustomLists;
  const defaultList = allLists.find((l: ListItem) => l.isDefault);
  const allTags: TagItem[] = tagsData?.tags ?? [];

  const smartListDefs: Record<string, { href: string; label: string; icon: typeof CalendarDays; color: string }> = useMemo(() => ({
    planned: { href: "/planned", label: t("sidebar.planned"), icon: CalendarDays, color: "text-green-500" },
    nearby: { href: "/nearby", label: t("sidebar.nearby"), icon: MapPin, color: "text-orange-500" },
    context: { href: "/context", label: t("sidebar.tasks"), icon: Zap, color: "text-yellow-500" },
  }), [t]);

  // Register list reorder callback with the shared DnD provider
  const handleListReorder = useCallback(
    (activeId: string, overId: string) => {
      const currentItems = localOrder ?? serverCustomLists;
      const oldIndex = currentItems.findIndex((l) => l.id === activeId);
      const newIndex = currentItems.findIndex((l) => l.id === overId);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(currentItems, oldIndex, newIndex);
      setLocalOrder(reordered);

      const input = reordered.map((l, i) => ({ id: l.id, sortOrder: i }));
      reorderLists({
        variables: { input },
        onCompleted: () => setLocalOrder(null),
        onError: () => setLocalOrder(null),
      });
    },
    [localOrder, serverCustomLists, reorderLists],
  );

  useEffect(() => {
    registerListReorder(handleListReorder);
  }, [registerListReorder, handleListReorder]);

  const handleSmartListReorder = useCallback(
    (activeId: string, overId: string) => {
      const oldIndex = smartOrder.indexOf(activeId);
      const newIndex = smartOrder.indexOf(overId);
      if (oldIndex === -1 || newIndex === -1) return;
      const reordered = arrayMove(smartOrder, oldIndex, newIndex);
      setSmartOrder(reordered);
      localStorage.setItem(SMART_LIST_ORDER_KEY, JSON.stringify(reordered));
    },
    [smartOrder],
  );

  useEffect(() => {
    registerSmartListReorder(handleSmartListReorder);
  }, [registerSmartListReorder, handleSmartListReorder]);

  function handleRenameList() {
    if (!renameListTarget || !renameListValue.trim()) return;
    updateList({
      variables: {
        id: renameListTarget.id,
        input: { name: renameListValue.trim(), icon: renameListIcon },
      },
    });
    setRenameListTarget(null);
  }

  function handleDeleteList() {
    if (!deleteListTarget) return;
    const wasActive = pathname === `/lists/${deleteListTarget.id}`;
    deleteList({
      variables: { id: deleteListTarget.id },
      update(cache) {
        cache.evict({ id: cache.identify({ __typename: "List", id: deleteListTarget.id }) });
        cache.gc();
      },
    });
    setDeleteListTarget(null);
    if (wasActive && defaultList) {
      router.push(`/lists/${defaultList.id}`);
    }
  }

  function handleRenameTag() {
    if (!renameTagTarget || !renameTagValue.trim()) return;
    updateTag({
      variables: { id: renameTagTarget.id, input: { name: renameTagValue.trim() } },
    });
    setRenameTagTarget(null);
  }

  function handleDeleteTag() {
    if (!deleteTagTarget) return;
    const wasActive = pathname === `/tags/${deleteTagTarget.id}`;
    deleteTag({
      variables: { id: deleteTagTarget.id },
      update(cache) {
        cache.evict({ id: cache.identify({ __typename: "Tag", id: deleteTagTarget.id }) });
        cache.gc();
      },
    });
    setDeleteTagTarget(null);
    if (wasActive && defaultList) {
      router.push(`/lists/${defaultList.id}`);
    }
  }

  return (
    <aside className="bg-sidebar flex h-full w-full flex-col">
      <div className="flex items-center gap-2 p-4">
        <UserMenu />
      </div>
      <ScrollArea className="min-h-0 flex-1 px-2">
        <SortableContext items={smartOrder} strategy={verticalListSortingStrategy}>
          <nav className="space-y-1">
            {smartOrder.map((id) => {
              const def = smartListDefs[id];
              if (!def) return null;
              if (id === "context" && defaultList) {
                return (
                  <SortableSmartItem key={id} id={id}>
                    <DroppableDefaultList
                      list={defaultList}
                      isActive={pathname === "/context"}
                      contextCount={contextTaskCount}
                      isDropTarget={activeType === "task" && overListId === defaultList.id}
                      onNavigate={closeSidebar}
                    />
                  </SortableSmartItem>
                );
              }
              const isActive = pathname === def.href;
              return (
                <SortableSmartItem key={id} id={id}>
                  <Link
                    href={def.href}
                    onClick={closeSidebar}
                    className={cn(
                      "hover:bg-sidebar-accent flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <def.icon className={cn("h-5 w-5", def.color)} />
                      {def.label}
                    </div>
                    {id === "nearby" && nearbyCount > 0 && (
                      <span className="text-muted-foreground text-xs">{nearbyCount}</span>
                    )}
                  </Link>
                </SortableSmartItem>
              );
            })}
          </nav>
        </SortableContext>

        <Separator className="my-3" />

        <SortableContext
          items={customLists.map((l) => l.id)}
          strategy={verticalListSortingStrategy}
        >
          <nav className="space-y-1">
            {customLists.map((list: ListItem) => (
              <SortableListItem
                key={list.id}
                list={list}
                isActive={pathname === `/lists/${list.id}`}
                taskCountMode={taskCountMode}
                isNearby={
                  list.location
                    ? checkNearby(list.location.latitude, list.location.longitude)
                    : false
                }
                isDeviceMatch={list.deviceContext === deviceContext}
                isDropTarget={activeType === "task" && overListId === list.id}
                onRename={(l) => {
                  setRenameListValue(l.name);
                  setRenameListIcon(l.icon ?? "list");
                  setRenameListTarget(l);
                }}
                onDelete={setDeleteListTarget}
                onNavigate={closeSidebar}
              />
            ))}
          </nav>
        </SortableContext>

        {allTags.length > 0 && (
          <>
            <Separator className="my-3" />
            <nav className="space-y-1">
              {allTags.map((tag) => (
                <SidebarTagItem
                  key={tag.id}
                  tag={tag}
                  isActive={pathname === `/tags/${tag.id}`}
                  isNearby={
                    tag.location
                      ? checkNearby(tag.location.latitude, tag.location.longitude)
                      : false
                  }
                  isDeviceMatch={tag.deviceContext === deviceContext}
                  onRename={(t) => {
                    setRenameTagValue(t.name);
                    setRenameTagTarget(t);
                  }}
                  onDelete={setDeleteTagTarget}
                  onNavigate={closeSidebar}
                />
              ))}
            </nav>
          </>
        )}
      </ScrollArea>

      <div className="border-t p-2">
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground w-full justify-start gap-2"
          onClick={() => setCreateListOpen(true)}
        >
          <Plus className="h-4 w-4" />
          {t("sidebar.newList")}
        </Button>
      </div>

      <CreateListDialog open={createListOpen} onOpenChange={setCreateListOpen} />

      {/* Rename list dialog */}
      <Dialog open={!!renameListTarget} onOpenChange={(open) => !open && setRenameListTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("lists.renameList")}</DialogTitle>
          </DialogHeader>
          <Input
            value={renameListValue}
            onChange={(e) => setRenameListValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRenameList()}
            autoFocus
          />
          <div className="grid grid-cols-8 gap-1.5">
            {Object.entries(LIST_ICONS).map(([key, Icon]) => (
              <button
                key={key}
                type="button"
                onClick={() => setRenameListIcon(key)}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-md transition-colors",
                  renameListIcon === key
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-4.5 w-4.5" />
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameListTarget(null)}>
              {t("lists.cancel")}
            </Button>
            <Button onClick={handleRenameList}>{t("lists.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete list alert */}
      <AlertDialog
        open={!!deleteListTarget}
        onOpenChange={(open) => !open && setDeleteListTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("common.deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("lists.deleteConfirmDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.deleteConfirmCancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteList}
            >
              {t("common.deleteConfirmAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rename tag dialog */}
      <Dialog open={!!renameTagTarget} onOpenChange={(open) => !open && setRenameTagTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("tags.renameTag")}</DialogTitle>
          </DialogHeader>
          <Input
            value={renameTagValue}
            onChange={(e) => setRenameTagValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRenameTag()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTagTarget(null)}>
              {t("lists.cancel")}
            </Button>
            <Button onClick={handleRenameTag}>{t("lists.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete tag alert */}
      <AlertDialog
        open={!!deleteTagTarget}
        onOpenChange={(open) => !open && setDeleteTagTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("common.deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("tags.deleteConfirmDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.deleteConfirmCancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteTag}
            >
              {t("common.deleteConfirmAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}
