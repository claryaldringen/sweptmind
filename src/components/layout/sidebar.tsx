"use client";

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useSyncExternalStore,
  type ComponentType,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { gql } from "@apollo/client";
import { useMutation } from "@apollo/client/react";
import {
  useLists,
  useAppData,
  type ListItem,
  type TagItem,
} from "@/components/providers/app-data-provider";
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
  AlertTriangle,
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
import { getFocusArea, setFocusArea, subscribeFocusArea } from "@/lib/focus-area";
import { UserMenu } from "./user-menu";
import {
  ListSelectionProvider,
  useListSelectionOptional,
} from "@/components/providers/list-selection-provider";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
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

const DELETE_LISTS = gql`
  mutation DeleteLists($ids: [String!]!) {
    deleteLists(ids: $ids)
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

type ListItemWithCounts = ListItem & { taskCount: number; visibleTaskCount: number };

function SortableListItem({
  list,
  isActive,
  sidebarHasFocus,
  taskCountMode,
  isNearby,
  isDeviceMatch,
  isDropTarget,
  hasConflict,
  smartListIds,
  onRename,
  onDelete,
  onBulkDelete,
  onNavigate,
}: {
  list: ListItemWithCounts;
  isActive: boolean;
  sidebarHasFocus: boolean;
  taskCountMode: "all" | "visible";
  isNearby: boolean;
  isDeviceMatch: boolean;
  isDropTarget: boolean;
  hasConflict: boolean;
  smartListIds: Set<string>;
  onRename: (list: ListItemWithCounts) => void;
  onDelete: (list: ListItemWithCounts) => void;
  onBulkDelete: (ids: string[]) => void;
  onNavigate?: () => void;
}) {
  const { t } = useTranslations();
  const listSelection = useListSelectionOptional();
  const isListSelected = listSelection?.selectedIds.has(list.id) ?? false;
  const isBulkMode = isListSelected && (listSelection?.selectedIds.size ?? 0) >= 2;
  const hasSmartListInSelection =
    isBulkMode && [...(listSelection?.selectedIds ?? [])].some((id) => smartListIds.has(id));

  const handleBulkDelete = () => {
    if (!listSelection) return;
    onBulkDelete([...listSelection.selectedIds]);
    listSelection.clear();
  };

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
            onMouseDown={(e) => {
              if (e.shiftKey) e.preventDefault();
            }}
            onClick={(e) => {
              setFocusArea("sidebar");
              if ((e.metaKey || e.ctrlKey || e.shiftKey) && listSelection) {
                e.preventDefault();
                listSelection.handleClick(list.id, {
                  metaKey: e.metaKey,
                  ctrlKey: e.ctrlKey,
                  shiftKey: e.shiftKey,
                });
                return;
              }
              listSelection?.handleClick(list.id, {});
              onNavigate?.();
            }}
            onContextMenu={() => {
              if (!isListSelected && listSelection) {
                listSelection.handleClick(list.id, {});
              }
            }}
            className={cn(
              "hover:bg-sidebar-accent flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive && sidebarHasFocus && "bg-sidebar-accent text-sidebar-accent-foreground",
              isActive && !sidebarHasFocus && "bg-sidebar-accent/50",
              isDragging && "opacity-50",
              isNearby && "bg-emerald-50 dark:bg-emerald-950/30",
              isDeviceMatch && "bg-yellow-50 dark:bg-yellow-950/30",
              isDropTarget && "ring-primary bg-primary/10 ring-2",
              isListSelected && "bg-sidebar-accent",
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
            <div className="flex items-center gap-1.5">
              {hasConflict && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
              {count > 0 && <span className="text-muted-foreground text-xs">{count}</span>}
            </div>
          </Link>
        </ContextMenuTrigger>
        <ContextMenuContent>
          {isBulkMode ? (
            <>
              <ContextMenuItem disabled className="text-muted-foreground text-xs">
                {t("bulkSelectedCount", { count: String(listSelection!.selectedIds.size) })}
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem
                variant="destructive"
                disabled={hasSmartListInSelection}
                onClick={handleBulkDelete}
              >
                <Trash2 className="h-4 w-4" />
                {t("bulkDelete")}
              </ContextMenuItem>
            </>
          ) : (
            <>
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
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
    </div>
  );
}

function DroppableDefaultList({
  list,
  isActive,
  sidebarHasFocus,
  contextCount,
  isDropTarget,
  smartListIds: _smartListIds,
  onNavigate,
}: {
  list: ListItem;
  isActive: boolean;
  sidebarHasFocus: boolean;
  contextCount: number;
  isDropTarget: boolean;
  smartListIds: Set<string>;
  onNavigate?: () => void;
}) {
  const { t } = useTranslations();
  const { setNodeRef } = useDroppable({
    id: list.id,
    data: { type: "list" },
  });
  const listSelection = useListSelectionOptional();
  const isSelected = listSelection?.selectedIds.has("context") ?? false;
  const isBulkMode = isSelected && (listSelection?.selectedIds.size ?? 0) >= 2;

  const link = (
    <Link
      href="/context"
      onMouseDown={(e) => {
        if (e.shiftKey) e.preventDefault();
      }}
      onClick={(e) => {
        setFocusArea("sidebar");
        if ((e.metaKey || e.ctrlKey || e.shiftKey) && listSelection) {
          e.preventDefault();
          listSelection.handleClick("context", {
            metaKey: e.metaKey,
            ctrlKey: e.ctrlKey,
            shiftKey: e.shiftKey,
          });
          return;
        }
        listSelection?.handleClick("context", {});
        onNavigate?.();
      }}
      onContextMenu={() => {
        if (!isSelected && listSelection) {
          listSelection.handleClick("context", {});
        }
      }}
      className={cn(
        "hover:bg-sidebar-accent flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        isActive && sidebarHasFocus && "bg-sidebar-accent text-sidebar-accent-foreground",
        isActive && !sidebarHasFocus && "bg-sidebar-accent/50",
        isDropTarget && "ring-primary bg-primary/10 ring-2",
        isSelected && "bg-sidebar-accent",
      )}
    >
      <div className="flex items-center gap-3">
        <Zap className="h-5 w-5 text-yellow-500" />
        {t("sidebar.tasks")}
      </div>
      {contextCount > 0 && <span className="text-muted-foreground text-xs">{contextCount}</span>}
    </Link>
  );

  if (isBulkMode) {
    return (
      <div ref={setNodeRef}>
        <ContextMenu>
          <ContextMenuTrigger asChild>{link}</ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem disabled className="text-muted-foreground text-xs">
              {t("bulkSelectedCount", { count: String(listSelection!.selectedIds.size) })}
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem variant="destructive" disabled>
              <Trash2 className="h-4 w-4" />
              {t("bulkDelete")}
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </div>
    );
  }

  return <div ref={setNodeRef}>{link}</div>;
}

function SidebarTagItem({
  tag,
  isActive,
  sidebarHasFocus,
  isNearby,
  isDeviceMatch,
  taskCount,
  smartListIds,
  onRename,
  onDelete,
  onBulkDelete,
  onNavigate,
}: {
  tag: TagItem;
  isActive: boolean;
  sidebarHasFocus: boolean;
  isNearby: boolean;
  isDeviceMatch: boolean;
  taskCount: number;
  smartListIds: Set<string>;
  onRename: (tag: TagItem) => void;
  onDelete: (tag: TagItem) => void;
  onBulkDelete: (ids: string[]) => void;
  onNavigate?: () => void;
}) {
  const { t } = useTranslations();
  const colors = getTagColorClasses(tag.color);
  const listSelection = useListSelectionOptional();
  const isSelected = listSelection?.selectedIds.has(tag.id) ?? false;
  const isBulkMode = isSelected && (listSelection?.selectedIds.size ?? 0) >= 2;
  const hasSmartListInSelection =
    isBulkMode && [...(listSelection?.selectedIds ?? [])].some((id) => smartListIds.has(id));

  const handleBulkDelete = () => {
    if (!listSelection) return;
    onBulkDelete([...listSelection.selectedIds]);
    listSelection.clear();
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <Link
          href={`/tags/${tag.id}`}
          onMouseDown={(e) => {
            if (e.shiftKey) e.preventDefault();
          }}
          onClick={(e) => {
            setFocusArea("sidebar");
            if ((e.metaKey || e.ctrlKey || e.shiftKey) && listSelection) {
              e.preventDefault();
              listSelection.handleClick(tag.id, {
                metaKey: e.metaKey,
                ctrlKey: e.ctrlKey,
                shiftKey: e.shiftKey,
              });
              return;
            }
            listSelection?.handleClick(tag.id, {});
            onNavigate?.();
          }}
          onContextMenu={() => {
            if (!isSelected && listSelection) {
              listSelection.handleClick(tag.id, {});
            }
          }}
          className={cn(
            "hover:bg-sidebar-accent flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            isActive && sidebarHasFocus && "bg-sidebar-accent text-sidebar-accent-foreground",
            isActive && !sidebarHasFocus && "bg-sidebar-accent/50",
            isNearby && "bg-emerald-50 dark:bg-emerald-950/30",
            isDeviceMatch && !isNearby && "bg-yellow-50 dark:bg-yellow-950/30",
            isSelected && "bg-sidebar-accent",
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
          {taskCount > 0 && <span className="text-muted-foreground text-xs">{taskCount}</span>}
        </Link>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {isBulkMode ? (
          <>
            <ContextMenuItem disabled className="text-muted-foreground text-xs">
              {t("bulkSelectedCount", { count: String(listSelection!.selectedIds.size) })}
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              variant="destructive"
              disabled={hasSmartListInSelection}
              onClick={handleBulkDelete}
            >
              <Trash2 className="h-4 w-4" />
              {t("bulkDelete")}
            </ContextMenuItem>
          </>
        ) : (
          <>
            <ContextMenuItem onClick={() => onRename(tag)}>
              <Pencil className="h-4 w-4" />
              {t("tags.rename")}
            </ContextMenuItem>
            <ContextMenuItem variant="destructive" onClick={() => onDelete(tag)}>
              <Trash2 className="h-4 w-4" />
              {t("tags.delete")}
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

function SidebarSmartListItem({
  id,
  href,
  label,
  icon: Icon,
  color,
  isActive,
  sidebarHasFocus,
  count,
  hasConflict,
  onNavigate,
}: {
  id: string;
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  color: string;
  isActive: boolean;
  sidebarHasFocus: boolean;
  count?: number;
  hasConflict?: boolean;
  onNavigate?: () => void;
}) {
  const { t } = useTranslations();
  const listSelection = useListSelectionOptional();
  const isSelected = listSelection?.selectedIds.has(id) ?? false;
  const isBulkMode = isSelected && (listSelection?.selectedIds.size ?? 0) >= 2;

  const link = (
    <Link
      href={href}
      onMouseDown={(e) => {
        if (e.shiftKey) e.preventDefault();
      }}
      onClick={(e) => {
        setFocusArea("sidebar");
        if ((e.metaKey || e.ctrlKey || e.shiftKey) && listSelection) {
          e.preventDefault();
          listSelection.handleClick(id, {
            metaKey: e.metaKey,
            ctrlKey: e.ctrlKey,
            shiftKey: e.shiftKey,
          });
          return;
        }
        listSelection?.handleClick(id, {});
        onNavigate?.();
      }}
      onContextMenu={() => {
        if (!isSelected && listSelection) {
          listSelection.handleClick(id, {});
        }
      }}
      className={cn(
        "hover:bg-sidebar-accent flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        isActive && sidebarHasFocus && "bg-sidebar-accent text-sidebar-accent-foreground",
        isActive && !sidebarHasFocus && "bg-sidebar-accent/50",
        isSelected && "bg-sidebar-accent",
      )}
    >
      <div className="flex items-center gap-3">
        <Icon className={cn("h-5 w-5", color)} />
        {label}
      </div>
      <div className="flex items-center gap-1.5">
        {hasConflict && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
        {count != null && count > 0 && (
          <span className="text-muted-foreground text-xs">{count}</span>
        )}
      </div>
    </Link>
  );

  if (isBulkMode) {
    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>{link}</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem disabled className="text-muted-foreground text-xs">
            {t("bulkSelectedCount", { count: String(listSelection!.selectedIds.size) })}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem variant="destructive" disabled>
            <Trash2 className="h-4 w-4" />
            {t("bulkDelete")}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  }

  return link;
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
  } catch {
    /* ignore */
  }
  return DEFAULT_SMART_ORDER;
}

function SortableSmartItem({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: { type: "smart-list" },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(isDragging && "z-10 opacity-50")}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}

export function Sidebar() {
  const { close: closeSidebar, isDesktop } = useSidebarContext();
  useKeyboardShortcuts();
  const focusArea = useSyncExternalStore(subscribeFocusArea, getFocusArea, getFocusArea);
  const sidebarHasFocus = focusArea === "sidebar";
  const { mode: taskCountMode } = useTaskCountMode();
  const deviceContext = useDeviceContext();
  const { t } = useTranslations();
  const pathname = usePathname();
  const router = useRouter();
  const { lists: allLists } = useLists();
  const { allTasks, tags: allTags, conflictingTaskIds } = useAppData();
  const [reorderLists] = useMutation(REORDER_LISTS);
  const [createListOpen, setCreateListOpen] = useState(false);
  const [localOrder, setLocalOrder] = useState<ListItemWithCounts[] | null>(null);
  const { isNearby: checkNearby, isTracking, nearbyLocationIds } = useNearby();
  const [smartOrder, setSmartOrder] = useState(getStoredSmartOrder);

  // Compute context task count from allTasks
  const contextTaskCount = useMemo(() => {
    const contextListIds = new Set(
      allLists
        .filter(
          (l) =>
            (deviceContext && l.deviceContext === deviceContext) ||
            (nearbyLocationIds.length > 0 &&
              l.locationId &&
              nearbyLocationIds.includes(l.locationId)),
        )
        .map((l) => l.id),
    );
    const contextTagIds = new Set(
      allTags
        .filter(
          (t) =>
            (deviceContext && t.deviceContext === deviceContext) ||
            (nearbyLocationIds.length > 0 &&
              t.locationId &&
              nearbyLocationIds.includes(t.locationId)),
        )
        .map((t) => t.id),
    );
    return allTasks.filter((task) => {
      if (task.isCompleted) return false;
      if (isFutureTask(task)) return false;
      if (deviceContext && task.deviceContext === deviceContext) return true;
      if (
        nearbyLocationIds.length > 0 &&
        task.locationId &&
        nearbyLocationIds.includes(task.locationId)
      )
        return true;
      if (contextListIds.has(task.listId)) return true;
      if (task.tags?.some((t) => contextTagIds.has(t.id))) return true;
      return false;
    }).length;
  }, [allTasks, allLists, allTags, deviceContext, nearbyLocationIds]);

  // Compute nearby count from allTasks (visible only)
  const nearbyCount = useMemo(() => {
    if (!isTracking) return 0;
    return allTasks.filter(
      (task) =>
        !task.isCompleted &&
        !isFutureTask(task) &&
        task.location &&
        checkNearby(task.location.latitude, task.location.longitude, task.location.radius),
    ).length;
  }, [allTasks, isTracking, checkNearby]);

  // Compute which lists contain visible tasks bound to a nearby location
  const listsWithNearbyTasks = useMemo(() => {
    const ids = new Set<string>();
    if (nearbyLocationIds.length === 0) return ids;
    for (const task of allTasks) {
      if (
        !task.isCompleted &&
        !isFutureTask(task) &&
        task.locationId &&
        nearbyLocationIds.includes(task.locationId)
      ) {
        ids.add(task.listId);
      }
    }
    return ids;
  }, [allTasks, nearbyLocationIds]);

  // Compute tag task counts from allTasks
  const tagTaskCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const task of allTasks) {
      if (task.isCompleted) continue;
      for (const tag of task.tags ?? []) {
        counts.set(tag.id, (counts.get(tag.id) ?? 0) + 1);
      }
    }
    return counts;
  }, [allTasks]);

  // Compute which lists contain conflicting tasks
  const listsWithConflicts = useMemo(() => {
    const ids = new Set<string>();
    if (conflictingTaskIds.size === 0) return ids;
    for (const task of allTasks) {
      if (conflictingTaskIds.has(task.id)) {
        ids.add(task.listId);
      }
    }
    return ids;
  }, [allTasks, conflictingTaskIds]);

  const hasAnyConflict = conflictingTaskIds.size > 0;

  const { registerListReorder, registerSmartListReorder, overListId, activeType } = useTaskDnd();

  // List rename/delete state
  const [renameListTarget, setRenameListTarget] = useState<ListItemWithCounts | null>(null);
  const [renameListValue, setRenameListValue] = useState("");
  const [renameListIcon, setRenameListIcon] = useState<string>("list");
  const [deleteListTarget, setDeleteListTarget] = useState<ListItemWithCounts | null>(null);
  const [updateList] = useMutation(UPDATE_LIST);
  const [deleteList] = useMutation(DELETE_LIST);

  // Tag rename/delete state
  const [renameTagTarget, setRenameTagTarget] = useState<TagItem | null>(null);
  const [renameTagValue, setRenameTagValue] = useState("");
  const [deleteTagTarget, setDeleteTagTarget] = useState<TagItem | null>(null);
  const [updateTag] = useMutation(UPDATE_TAG);
  const [deleteTag] = useMutation(DELETE_TAG);

  const serverCustomLists = allLists
    .filter((l) => !l.isDefault)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const customLists = localOrder ?? serverCustomLists;
  const defaultList = allLists.find((l) => l.isDefault);
  const sidebarSelectableIds = useMemo(
    () => [...smartOrder, ...customLists.map((l) => l.id), ...allTags.map((t) => t.id)],
    [smartOrder, customLists, allTags],
  );
  const listIdSet = useMemo(() => new Set(customLists.map((l) => l.id)), [customLists]);
  const smartListIdSet = useMemo(() => new Set(smartOrder), [smartOrder]);

  const [deleteListsBulk] = useMutation(DELETE_LISTS);
  const [deleteTagBulk] = useMutation(DELETE_TAG);
  const handleSidebarBulkDelete = useCallback(
    (ids: string[]) => {
      // Skip if any smart list is in selection
      if (ids.some((id) => smartListIdSet.has(id))) return;
      const listIdsToDelete = ids.filter((id) => listIdSet.has(id));
      const tagIdsToDelete = ids.filter((id) => !listIdSet.has(id));
      if (listIdsToDelete.length > 0) {
        deleteListsBulk({
          variables: { ids: listIdsToDelete },
          update(cache) {
            for (const id of listIdsToDelete) {
              cache.evict({ id: cache.identify({ __typename: "List", id }) });
            }
            cache.gc();
          },
        });
      }
      for (const id of tagIdsToDelete) {
        deleteTagBulk({
          variables: { id },
          update(cache) {
            cache.evict({ id: cache.identify({ __typename: "Tag", id }) });
            cache.gc();
          },
        });
      }
    },
    [smartListIdSet, listIdSet, deleteListsBulk, deleteTagBulk],
  );

  const smartListDefs: Record<
    string,
    { href: string; label: string; icon: typeof CalendarDays; color: string }
  > = useMemo(
    () => ({
      planned: {
        href: "/planned",
        label: t("sidebar.planned"),
        icon: CalendarDays,
        color: "text-green-500",
      },
      nearby: {
        href: "/nearby",
        label: t("sidebar.nearby"),
        icon: MapPin,
        color: "text-orange-500",
      },
      context: { href: "/context", label: t("sidebar.tasks"), icon: Zap, color: "text-yellow-500" },
    }),
    [t],
  );

  // Ordered list of all sidebar item hrefs for arrow key navigation
  const sidebarHrefs = useMemo(() => {
    const hrefs: string[] = [];
    for (const id of smartOrder) {
      if (id === "context") {
        hrefs.push("/context");
      } else if (smartListDefs[id]) {
        hrefs.push(smartListDefs[id].href);
      }
    }
    for (const list of customLists) {
      hrefs.push(`/lists/${list.id}`);
    }
    for (const tag of allTags) {
      hrefs.push(`/tags/${tag.id}`);
    }
    return hrefs;
  }, [smartOrder, smartListDefs, customLists, allTags]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (getFocusArea() !== "sidebar") return;

      if (e.key === "ArrowRight") {
        e.preventDefault();
        setFocusArea("tasks");
        return;
      }

      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      if (e.shiftKey) return; // Shift+arrow handled by ListSelectionProvider

      const currentIdx = sidebarHrefs.indexOf(pathname);
      if (currentIdx === -1) return;
      const nextIdx = e.key === "ArrowDown" ? currentIdx + 1 : currentIdx - 1;
      if (nextIdx < 0 || nextIdx >= sidebarHrefs.length) return;
      e.preventDefault();
      router.push(sidebarHrefs[nextIdx]);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [sidebarHrefs, pathname, router]);

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
        update(cache) {
          for (const { id, sortOrder } of input) {
            cache.modify({
              id: cache.identify({ __typename: "List", id }),
              fields: { sortOrder: () => sortOrder },
            });
          }
        },
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
        <ListSelectionProvider
          listIds={sidebarSelectableIds}
          onBulkDelete={handleSidebarBulkDelete}
        >
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
                        isActive={isDesktop && pathname === "/context"}
                        sidebarHasFocus={sidebarHasFocus}
                        contextCount={contextTaskCount}
                        isDropTarget={activeType === "task" && overListId === defaultList.id}
                        smartListIds={smartListIdSet}
                        onNavigate={closeSidebar}
                      />
                    </SortableSmartItem>
                  );
                }
                return (
                  <SortableSmartItem key={id} id={id}>
                    <SidebarSmartListItem
                      id={id}
                      href={def.href}
                      label={def.label}
                      icon={def.icon}
                      color={def.color}
                      isActive={isDesktop && pathname === def.href}
                      sidebarHasFocus={sidebarHasFocus}
                      count={id === "nearby" ? nearbyCount : undefined}
                      hasConflict={id === "planned" && hasAnyConflict}
                      onNavigate={closeSidebar}
                    />
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
              {customLists.map((list) => (
                <SortableListItem
                  key={list.id}
                  list={list}
                  isActive={isDesktop && pathname === `/lists/${list.id}`}
                  sidebarHasFocus={sidebarHasFocus}
                  taskCountMode={taskCountMode}
                  smartListIds={smartListIdSet}
                  onBulkDelete={handleSidebarBulkDelete}
                  isNearby={
                    (list.location
                      ? checkNearby(
                          list.location.latitude,
                          list.location.longitude,
                          list.location.radius,
                        )
                      : false) || listsWithNearbyTasks.has(list.id)
                  }
                  isDeviceMatch={list.deviceContext === deviceContext}
                  isDropTarget={activeType === "task" && overListId === list.id}
                  hasConflict={listsWithConflicts.has(list.id)}
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
                    isActive={isDesktop && pathname === `/tags/${tag.id}`}
                    sidebarHasFocus={sidebarHasFocus}
                    isNearby={
                      tag.location
                        ? checkNearby(
                            tag.location.latitude,
                            tag.location.longitude,
                            tag.location.radius,
                          )
                        : false
                    }
                    isDeviceMatch={tag.deviceContext === deviceContext}
                    taskCount={tagTaskCounts.get(tag.id) ?? 0}
                    smartListIds={smartListIdSet}
                    onBulkDelete={handleSidebarBulkDelete}
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
        </ListSelectionProvider>
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
