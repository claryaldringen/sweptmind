"use client";

import {
  memo,
  useMemo,
  useState,
  useEffect,
  useRef,
  useSyncExternalStore,
  type MouseEvent,
} from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { gql } from "@apollo/client";
import { useMutation, useApolloClient } from "@apollo/client/react";
import { useLists } from "@/components/providers/app-data-provider";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bell,
  CalendarDays,
  Check,
  FolderOutput,
  Lightbulb,
  Link2,
  List,
  Lock,
  MapPin,
  Monitor,
  AlertTriangle,
  Paperclip,
  Repeat,
  RotateCcw,
  Smartphone,
  Trash2,
  Users,
  X,
} from "lucide-react";
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
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import { setFocusArea, subscribeFocusArea, getFocusArea } from "@/lib/focus-area";
import { getTagColorClasses } from "@/lib/tag-colors";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { format, isPast, parseISO, startOfDay, addDays } from "date-fns";
import { cs } from "date-fns/locale/cs";
import { enUS } from "date-fns/locale/en-US";
import { useTranslations } from "@/lib/i18n";
import { useNearby } from "@/components/providers/nearby-provider";
import { useDeviceContext } from "@/hooks/use-device-context";
import { useTaskSelectionOptional } from "@/components/providers/task-selection-provider";
import { useAppData } from "@/components/providers/app-data-provider";
import {
  TOGGLE_TASK_COMPLETED as TOGGLE_COMPLETED,
  DELETE_TASK,
  DELETE_TASKS,
} from "@/graphql/shared/task-mutations";
import type { Task } from "./types";

const UPDATE_TASK = gql`
  mutation UpdateTask($id: String!, $input: UpdateTaskInput!) {
    updateTask(id: $id, input: $input) {
      id
      title
      dueDate
      dueDateEnd
      listId
      locationId
      recurrence
      location {
        id
        name
        latitude
        longitude
        radius
      }
    }
  }
`;

const CONVERT_TASK_TO_LIST = gql`
  mutation ConvertTaskToList($taskId: String!) {
    convertTaskToList(taskId: $taskId) {
      id
      name
    }
  }
`;

const UPDATE_TASKS = gql`
  mutation UpdateTasks($ids: [String!]!, $input: BulkTaskUpdateInput!) {
    updateTasks(ids: $ids, input: $input)
  }
`;

const SET_TASKS_COMPLETED = gql`
  mutation SetTasksCompleted($ids: [String!]!, $isCompleted: Boolean!) {
    setTasksCompleted(ids: $ids, isCompleted: $isCompleted)
  }
`;

/** Computed once per module load – stable for the lifetime of the page. */
const LOCAL_TODAY = format(new Date(), "yyyy-MM-dd");

interface TaskItemProps {
  task: Task;
  showListName?: boolean;
  onDelete?: () => void;
  fadingOut?: boolean;
  analyzingTaskIds?: Set<string>;
}

export const TaskItem = memo(function TaskItem({
  task,
  showListName = false,
  onDelete,
  fadingOut: externalFadingOut = false,
  analyzingTaskIds,
}: TaskItemProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, tArray, locale: appLocale } = useTranslations();
  const dateFnsLocale = appLocale === "cs" ? cs : enUS;
  const selectedTaskId = searchParams.get("task");
  const { isNearby: checkNearby } = useNearby();
  const deviceContext = useDeviceContext();
  const taskSelection = useTaskSelectionOptional();
  const isSelected = taskSelection?.selectedIds.has(task.id) ?? false;
  const { conflictingTaskIds } = useAppData();
  const isConflicting = conflictingTaskIds.has(task.id);
  const focusArea = useSyncExternalStore(subscribeFocusArea, getFocusArea, getFocusArea);
  const tasksHaveFocus = focusArea === "tasks";
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const client = useApolloClient();
  const { cache } = client;

  const [deleteTasks] = useMutation(DELETE_TASKS);
  const [updateTasks] = useMutation(UPDATE_TASKS);
  const [setTasksCompleted] = useMutation(SET_TASKS_COMPLETED);

  const selectedIds = taskSelection?.selectedIds ?? new Set<string>();
  const isBulkMode = isSelected && selectedIds.size >= 2;
  const bulkIds = [...selectedIds];

  const [localChecked, setLocalChecked] = useState<boolean | null>(null);
  const [prevIsCompleted, setPrevIsCompleted] = useState(task.isCompleted);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const completionTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    return () => completionTimersRef.current.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (isSelected && rowRef.current) {
      rowRef.current.scrollIntoView({ block: "nearest" });
    }
  }, [isSelected]);

  if (prevIsCompleted !== task.isCompleted) {
    setPrevIsCompleted(task.isCompleted);
    if (localChecked !== null && task.isCompleted === localChecked) {
      setLocalChecked(null);
    }
  }

  const [toggleCompleted] = useMutation<{
    toggleTaskCompleted: {
      __typename: "Task";
      id: string;
      isCompleted: boolean;
      completedAt: string | null;
      dueDate: string | null;
      dueDateEnd: string | null;
      reminderAt: string | null;
    };
  }>(TOGGLE_COMPLETED, {
    optimisticResponse: {
      toggleTaskCompleted: {
        __typename: "Task" as const,
        id: task.id,
        isCompleted: !task.isCompleted,
        completedAt: task.isCompleted ? null : new Date().toISOString(),
        dueDate: task.dueDate,
        dueDateEnd: task.dueDateEnd ?? null,
        reminderAt: task.reminderAt,
      },
    },
    update(cache, { data }) {
      if (!data?.toggleTaskCompleted) return;
      const { id: completedId, isCompleted } = data.toggleTaskCompleted;
      // Update blockedByTaskIsCompleted on all tasks that depend on this one
      cache.modify({
        fields: {
          activeTasks(existing = [], { readField }) {
            for (const ref of existing) {
              if (readField("blockedByTaskId", ref) === completedId) {
                cache.modify({
                  id: (ref as { __ref: string }).__ref,
                  fields: {
                    blockedByTaskIsCompleted: () => isCompleted,
                  },
                });
              }
            }
            return existing;
          },
        },
      });
    },
  });
  const visuallyCompleted = localChecked ?? task.isCompleted;

  const [updateTask] = useMutation(UPDATE_TASK);
  const [deleteTask] = useMutation<{ deleteTask: boolean }>(DELETE_TASK, {
    update(cache) {
      cache.evict({ id: cache.identify({ __typename: "Task", id: task.id }) });
      cache.gc();
    },
  });

  const { lists } = useLists();
  const [convertTaskToList] = useMutation<{ convertTaskToList: { id: string; name: string } }>(
    CONVERT_TASK_TO_LIST,
    {
      update(cache, { data }) {
        cache.evict({ id: cache.identify({ __typename: "Task", id: task.id }) });
        cache.gc();
        if (!data?.convertTaskToList) return;
        cache.modify({
          fields: {
            lists(existing = []) {
              const newRef = cache.writeFragment({
                data: {
                  __typename: "List",
                  ...data.convertTaskToList,
                  icon: null,
                  themeColor: null,
                  isDefault: false,
                  sortOrder: 0,
                  groupId: null,
                  taskCount: 0,
                  visibleTaskCount: 0,
                  locationId: null,
                  location: null,
                  deviceContext: null,
                },
                fragment: gql`
                  fragment NewList on List {
                    id
                    name
                    icon
                    themeColor
                    isDefault
                    sortOrder
                    groupId
                    taskCount
                    visibleTaskCount
                    locationId
                    location {
                      id
                      name
                      latitude
                      longitude
                      radius
                    }
                    deviceContext
                  }
                `,
              });
              return [...existing, newRef];
            },
          },
        });
      },
    },
  );

  const listsMap = useMemo(() => {
    const m = new Map<string, (typeof lists)[number]>();
    for (const l of lists) m.set(l.id, l);
    return m;
  }, [lists]);

  const {
    completedSteps,
    totalSteps,
    hasTags,
    dueDateParsed,
    isDueToday,
    isOverdue,
    hasReminder,
    isReminderToday,
    hasRecurrence,
    hasLocation,
    locationNearby,
    taskList,
    deviceMatch,
    hasAttachments,
    isBlocked,
    dependentCount,
    hasMetadata,
  } = useMemo(() => {
    const completedSteps = task.steps?.filter((s) => s.isCompleted).length ?? 0;
    const totalSteps = task.steps?.length ?? 0;
    const hasTags = (task.tags?.length ?? 0) > 0;
    const dueDateParsed = task.dueDate ? parseISO(task.dueDate) : null;
    const isDueToday = task.dueDate?.split("T")[0] === LOCAL_TODAY;
    const isOverdue =
      dueDateParsed && !task.isCompleted && !isDueToday && isPast(startOfDay(dueDateParsed));
    const hasReminder = !!task.reminderAt;
    const isReminderToday = task.reminderAt?.split("T")[0] === LOCAL_TODAY;
    const hasRecurrence = !!task.recurrence;
    const hasLocation = !!task.location;
    const locationNearby = task.location
      ? checkNearby(
          task.location.latitude,
          task.location.longitude,
          task.locationRadius ?? task.location.radius,
        )
      : false;
    const taskList = task.list ? listsMap.get(task.list.id) : undefined;
    const deviceMatch =
      !locationNearby &&
      (task.deviceContext === deviceContext || taskList?.deviceContext === deviceContext);
    const hasAttachments = (task.attachments?.length ?? 0) > 0;
    const isBlocked = !!task.blockedByTaskId && task.blockedByTaskIsCompleted === false;
    const dependentCount = task.dependentTaskCount ?? 0;
    const hasMetadata =
      isBlocked ||
      dependentCount > 0 ||
      (showListName && task.list) ||
      task.dueDate ||
      totalSteps > 0 ||
      hasTags ||
      hasReminder ||
      hasRecurrence ||
      hasLocation ||
      hasAttachments ||
      deviceMatch ||
      task.isSharedTo ||
      task.isSharedFrom;

    return {
      completedSteps,
      totalSteps,
      hasTags,
      dueDateParsed,
      isDueToday,
      isOverdue,
      hasReminder,
      isReminderToday,
      hasRecurrence,
      hasLocation,
      locationNearby,
      taskList,
      deviceMatch,
      hasAttachments,
      isBlocked,
      dependentCount,
      hasMetadata,
    };
  }, [task, listsMap, checkNearby, deviceContext, showListName]);

  const allLists = lists;

  function handleClick(e: MouseEvent) {
    setFocusArea("tasks");
    if (e.metaKey || e.ctrlKey || e.shiftKey) {
      e.preventDefault();
      taskSelection?.handleClick(task.id, {
        metaKey: e.metaKey,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
      });
      // Close detail panel when multi-selecting
      const params = new URLSearchParams(searchParams.toString());
      if (params.has("task")) {
        params.delete("task");
        router.replace(`?${params.toString()}`, { scroll: false });
      }
      return;
    }
    // Original behavior: single-select (sets anchor) and open detail panel
    taskSelection?.handleClick(task.id, {});
    const params = new URLSearchParams(searchParams.toString());
    params.set("task", task.id);
    params.delete("ai");
    router.push(`?${params.toString()}`, { scroll: false });
  }

  function setDueDate(daysFromNow: number) {
    const date = addDays(new Date(), daysFromNow);
    const dateStr = format(date, "yyyy-MM-dd");
    updateTask({ variables: { id: task.id, input: { dueDate: dateStr } } });
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            ref={rowRef}
            className={cn(
              "group hover:bg-accent flex cursor-pointer items-center gap-3 rounded-md px-4 py-2.5 transition-all duration-500",
              (selectedTaskId === task.id || isSelected) && tasksHaveFocus && "bg-accent",
              (selectedTaskId === task.id || isSelected) && !tasksHaveFocus && "bg-accent/50",
              isConflicting && "bg-red-50 dark:bg-red-950/20",
              locationNearby && "bg-emerald-50 dark:bg-emerald-950/30",
              deviceMatch && "bg-yellow-50 dark:bg-yellow-950/30",
              (fadingOut || externalFadingOut) && "opacity-0",
            )}
            onMouseDown={(e) => {
              if (e.shiftKey) e.preventDefault();
            }}
            onClick={handleClick}
            onContextMenu={() => {
              if (!isSelected && taskSelection) {
                taskSelection.handleClick(task.id, {});
              }
            }}
          >
            <Checkbox
              checked={visuallyCompleted}
              onCheckedChange={() => {
                const completing = !visuallyCompleted;
                setLocalChecked(completing);
                if (completing) {
                  // Show checkmark, then fade out, then fire mutation
                  completionTimersRef.current = [
                    setTimeout(() => setFadingOut(true), 400),
                    setTimeout(() => {
                      toggleCompleted({ variables: { id: task.id } });
                    }, 900),
                  ];
                } else {
                  toggleCompleted({ variables: { id: task.id } });
                }
              }}
              onClick={(e) => e.stopPropagation()}
              className="rounded-full"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                {isDesktop && selectedTaskId === task.id && selectedIds.size < 2 ? (
                  <input
                    key={task.id + task.title}
                    defaultValue={task.title}
                    size={task.title.length || 1}
                    onClick={(e: MouseEvent<HTMLInputElement>) => e.stopPropagation()}
                    onChange={(e) => {
                      e.target.size = e.target.value.length || 1;
                    }}
                    onBlur={(e) => {
                      const newTitle = e.target.value.trim();
                      if (newTitle && newTitle !== task.title) {
                        updateTask({ variables: { id: task.id, input: { title: newTitle } } });
                      } else {
                        e.target.value = task.title;
                        e.target.size = task.title.length || 1;
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                      if (e.key === "Escape") {
                        e.currentTarget.value = task.title;
                        e.currentTarget.size = task.title.length || 1;
                        e.currentTarget.blur();
                      }
                    }}
                    className={cn(
                      "max-w-full min-w-0 bg-transparent text-sm outline-none",
                      visuallyCompleted && "text-muted-foreground line-through",
                    )}
                  />
                ) : (
                  <span
                    className={cn(
                      "truncate text-sm",
                      visuallyCompleted && "text-muted-foreground line-through",
                    )}
                  >
                    {task.title}
                  </span>
                )}
                {task.aiAnalysis &&
                  (task.aiAnalysis.suggestedTitle ||
                    task.aiAnalysis.decomposition?.length ||
                    task.aiAnalysis.duplicateTaskId ||
                    task.aiAnalysis.callIntent) && (
                    <button
                      type="button"
                      aria-label={task.aiAnalysis.suggestion ?? t("premium.aiNotActionable")}
                      title={task.aiAnalysis.suggestion ?? t("premium.aiNotActionable")}
                      onClick={(e) => {
                        e.stopPropagation();
                        const params = new URLSearchParams(searchParams.toString());
                        params.set("task", task.id);
                        params.set("ai", "1");
                        router.push(`?${params.toString()}`, { scroll: false });
                      }}
                      className="cursor-pointer"
                    >
                      <Lightbulb className="h-5 w-5 shrink-0 text-yellow-500" />
                    </button>
                  )}
                {analyzingTaskIds?.has(task.id) && !task.aiAnalysis && (
                  <span title={t("premium.aiAnalyzing")}>
                    <Lightbulb className="h-3.5 w-3.5 shrink-0 animate-pulse text-yellow-500/50" />
                  </span>
                )}
              </div>
              {hasMetadata && (
                <div className="flex items-center gap-1 text-xs">
                  {showListName && task.list && (
                    <span className="text-muted-foreground">{task.list.name}</span>
                  )}
                  {showListName && task.list && (task.dueDate || totalSteps > 0) && (
                    <span className="text-muted-foreground">·</span>
                  )}
                  {task.dueDate && (
                    <span
                      className={cn(
                        "flex items-center gap-0.5",
                        isOverdue
                          ? "text-red-600"
                          : isDueToday
                            ? "text-blue-500"
                            : "text-muted-foreground",
                      )}
                    >
                      <CalendarDays className="h-3 w-3" />
                      {isDueToday
                        ? t("tasks.today")
                        : task.dueDateEnd
                          ? `${format(dueDateParsed!, task.dueDate.includes("T") ? "MMM d, h:mm a" : "MMM d", { locale: dateFnsLocale })} – ${format(parseISO(task.dueDateEnd), task.dueDateEnd.includes("T") ? "MMM d, h:mm a" : "MMM d", { locale: dateFnsLocale })}`
                          : format(
                              dueDateParsed!,
                              task.dueDate.includes("T") ? "MMM d, h:mm a" : "MMM d",
                              { locale: dateFnsLocale },
                            )}
                    </span>
                  )}
                  {task.dueDate && (hasReminder || totalSteps > 0) && (
                    <span className="text-muted-foreground">·</span>
                  )}
                  {hasReminder && (
                    <span
                      className={cn(
                        "flex items-center gap-0.5",
                        isReminderToday ? "text-blue-500" : "text-muted-foreground",
                      )}
                    >
                      <Bell className="h-3 w-3" />
                      {isReminderToday
                        ? t("tasks.today")
                        : format(parseISO(task.reminderAt!), "MMM d", {
                            locale: dateFnsLocale,
                          })}
                    </span>
                  )}
                  {hasReminder && (hasRecurrence || totalSteps > 0) && (
                    <span className="text-muted-foreground">·</span>
                  )}
                  {hasRecurrence && (
                    <span className="text-muted-foreground flex items-center gap-0.5">
                      <Repeat className="h-3 w-3" />
                      {task.recurrence === "DAILY"
                        ? t("recurrence.daily")
                        : task.recurrence === "MONTHLY"
                          ? t("recurrence.monthly")
                          : task.recurrence === "MONTHLY_LAST"
                            ? t("recurrence.monthlyLast")
                            : task.recurrence === "YEARLY"
                              ? t("recurrence.yearly")
                              : task.recurrence?.startsWith("WEEKLY:")
                                ? (() => {
                                    const days = task.recurrence!.slice(7).split(",").map(Number);
                                    const dayNames = tArray("recurrence.daysShort");
                                    return days.length === 7
                                      ? t("recurrence.daily")
                                      : days.map((d) => dayNames[d]).join(", ");
                                  })()
                                : t("recurrence.weekly")}
                    </span>
                  )}
                  {hasRecurrence && totalSteps > 0 && (
                    <span className="text-muted-foreground">·</span>
                  )}
                  {totalSteps > 0 && (
                    <span className="text-muted-foreground">
                      {completedSteps}/{totalSteps}
                    </span>
                  )}
                  {hasTags && (totalSteps > 0 || task.dueDate || (showListName && task.list)) && (
                    <span className="text-muted-foreground">·</span>
                  )}
                  {task.tags?.map((tag) => {
                    const colors = getTagColorClasses(tag.color);
                    return (
                      <Badge
                        key={tag.id}
                        variant="secondary"
                        className={cn("h-4 px-1.5 text-[10px]", colors.bg, colors.text)}
                      >
                        {tag.name}
                      </Badge>
                    );
                  })}
                  {hasLocation &&
                    (hasTags ||
                      totalSteps > 0 ||
                      task.dueDate ||
                      hasReminder ||
                      (showListName && task.list)) && (
                      <span className="text-muted-foreground">·</span>
                    )}
                  {hasLocation && (
                    <span
                      className={cn(
                        "group/loc flex items-center gap-0.5",
                        locationNearby ? "text-green-500" : "text-muted-foreground",
                      )}
                    >
                      <MapPin className={cn("h-3 w-3", locationNearby && "animate-pulse")} />
                      {task.location!.name}
                      <button
                        type="button"
                        aria-label={t("tasks.removeLocation")}
                        onClick={(e) => {
                          e.stopPropagation();
                          updateTask({ variables: { id: task.id, input: { locationId: null } } });
                        }}
                        className="rounded-full p-0.5 opacity-0 transition-opacity group-hover/loc:opacity-100 hover:bg-black/10 dark:hover:bg-white/10"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  )}
                  {hasAttachments &&
                    (hasLocation ||
                      hasTags ||
                      totalSteps > 0 ||
                      task.dueDate ||
                      hasReminder ||
                      hasRecurrence ||
                      (showListName && task.list)) && (
                      <span className="text-muted-foreground">·</span>
                    )}
                  {hasAttachments && (
                    <span className="text-muted-foreground flex items-center gap-0.5">
                      <Paperclip className="h-3 w-3" />
                    </span>
                  )}
                  {deviceMatch &&
                    (hasAttachments ||
                      hasLocation ||
                      hasTags ||
                      totalSteps > 0 ||
                      task.dueDate ||
                      hasReminder ||
                      (showListName && task.list)) && (
                      <span className="text-muted-foreground">·</span>
                    )}
                  {deviceMatch && (
                    <span className="flex items-center gap-0.5 text-yellow-500">
                      {taskList?.deviceContext === "phone" ? (
                        <Smartphone className="h-3 w-3 animate-pulse" />
                      ) : (
                        <Monitor className="h-3 w-3 animate-pulse" />
                      )}
                    </span>
                  )}
                  {isBlocked &&
                    (deviceMatch ||
                      hasAttachments ||
                      hasLocation ||
                      hasTags ||
                      totalSteps > 0 ||
                      task.dueDate ||
                      hasReminder ||
                      (showListName && task.list)) && (
                      <span className="text-muted-foreground">·</span>
                    )}
                  {isBlocked && (
                    <span className="text-muted-foreground flex items-center gap-0.5">
                      <Lock className="h-3 w-3" />
                    </span>
                  )}
                  {dependentCount > 0 &&
                    (isBlocked ||
                      deviceMatch ||
                      hasAttachments ||
                      hasLocation ||
                      hasTags ||
                      totalSteps > 0 ||
                      task.dueDate ||
                      hasReminder ||
                      (showListName && task.list)) && (
                      <span className="text-muted-foreground">·</span>
                    )}
                  {dependentCount > 0 && (
                    <span className="text-muted-foreground flex items-center gap-0.5">
                      <Link2 className="h-3 w-3" />
                      {dependentCount}
                    </span>
                  )}
                  {isConflicting && (
                    <span className="flex items-center gap-0.5 text-red-600">
                      <AlertTriangle className="h-3 w-3" />
                    </span>
                  )}
                  {task.isGoogleCalendarEvent && (
                    <span
                      className="flex items-center gap-0.5 text-blue-600"
                      title="Google Calendar"
                    >
                      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 4h-1V3c0-.6-.4-1-1-1s-1 .4-1 1v1H8V3c0-.6-.4-1-1-1s-1 .4-1 1v1H5C3.3 4 2 5.3 2 7v12c0 1.7 1.3 3 3 3h14c1.7 0 3-1.3 3-3V7c0-1.7-1.3-3-3-3zm1 15c0 .6-.4 1-1 1H5c-.6 0-1-.4-1-1v-9h16v9zm0-11H4V7c0-.6.4-1 1-1h1v1c0 .6.4 1 1 1s1-.4 1-1V6h8v1c0 .6.4 1 1 1s1-.4 1-1V6h1c.6 0 1 .4 1 1v1z" />
                        <text
                          x="12"
                          y="18"
                          textAnchor="middle"
                          fontSize="8"
                          fontWeight="bold"
                          fill="currentColor"
                        >
                          G
                        </text>
                      </svg>
                    </span>
                  )}
                  {task.isSharedTo && (
                    <span
                      className="flex items-center gap-0.5 text-blue-500"
                      title={t("sharing.sharedTo")}
                    >
                      <Users className="h-3 w-3" />
                    </span>
                  )}
                  {task.isSharedFrom && (
                    <span
                      className="flex items-center gap-0.5 text-amber-500"
                      title={t("sharing.incomingTasks")}
                    >
                      <Link2 className="h-3 w-3" />
                    </span>
                  )}
                </div>
              )}
            </div>
            <button
              type="button"
              aria-label={t("common.deleteConfirmAction")}
              className={cn(
                "shrink-0 cursor-pointer transition-opacity",
                isDesktop ? "opacity-0 group-hover:opacity-100" : "opacity-60",
              )}
              onClick={(e) => {
                e.stopPropagation();
                setDeleteOpen(true);
              }}
            >
              <Trash2 className="text-muted-foreground h-4 w-4" />
            </button>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          {isBulkMode ? (
            <>
              <ContextMenuItem disabled className="text-muted-foreground text-xs">
                {t("bulkSelectedCount", { count: String(selectedIds.size) })}
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem
                onClick={() => {
                  setTasksCompleted({ variables: { ids: bulkIds, isCompleted: true } });
                  for (const id of bulkIds) {
                    cache.modify({
                      id: cache.identify({ __typename: "Task", id }),
                      fields: {
                        isCompleted: () => true,
                        completedAt: () => new Date().toISOString(),
                      },
                    });
                  }
                  taskSelection?.clear();
                }}
              >
                <Check className="mr-2 h-4 w-4" />
                {t("bulkComplete")}
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => {
                  setTasksCompleted({ variables: { ids: bulkIds, isCompleted: false } });
                  for (const id of bulkIds) {
                    cache.modify({
                      id: cache.identify({ __typename: "Task", id }),
                      fields: {
                        isCompleted: () => false,
                        completedAt: () => null,
                      },
                    });
                  }
                  taskSelection?.clear();
                }}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                {t("bulkUncomplete")}
              </ContextMenuItem>
              <ContextMenuSub>
                <ContextMenuSubTrigger>
                  <List className="mr-2 h-4 w-4" />
                  {t("bulkMoveTo")}
                </ContextMenuSubTrigger>
                <ContextMenuSubContent>
                  {allLists.map((list) => (
                    <ContextMenuItem
                      key={list.id}
                      onClick={() => {
                        updateTasks({ variables: { ids: bulkIds, input: { listId: list.id } } });
                        for (const id of bulkIds) {
                          cache.modify({
                            id: cache.identify({ __typename: "Task", id }),
                            fields: { listId: () => list.id },
                          });
                        }
                        taskSelection?.clear();
                      }}
                    >
                      {list.name}
                    </ContextMenuItem>
                  ))}
                </ContextMenuSubContent>
              </ContextMenuSub>
              <ContextMenuSub>
                <ContextMenuSubTrigger>
                  <CalendarDays className="mr-2 h-4 w-4" />
                  {t("bulkSetDueDate")}
                </ContextMenuSubTrigger>
                <ContextMenuSubContent>
                  <ContextMenuItem
                    onClick={() => {
                      const dateStr = format(new Date(), "yyyy-MM-dd");
                      updateTasks({ variables: { ids: bulkIds, input: { dueDate: dateStr } } });
                      for (const id of bulkIds) {
                        cache.modify({
                          id: cache.identify({ __typename: "Task", id }),
                          fields: { dueDate: () => dateStr },
                        });
                      }
                      taskSelection?.clear();
                    }}
                  >
                    {t("tasks.today")}
                  </ContextMenuItem>
                  <ContextMenuItem
                    onClick={() => {
                      const dateStr = format(addDays(new Date(), 1), "yyyy-MM-dd");
                      updateTasks({ variables: { ids: bulkIds, input: { dueDate: dateStr } } });
                      for (const id of bulkIds) {
                        cache.modify({
                          id: cache.identify({ __typename: "Task", id }),
                          fields: { dueDate: () => dateStr },
                        });
                      }
                      taskSelection?.clear();
                    }}
                  >
                    {t("tasks.tomorrow")}
                  </ContextMenuItem>
                  <ContextMenuItem
                    onClick={() => {
                      const dateStr = format(addDays(new Date(), 2), "yyyy-MM-dd");
                      updateTasks({ variables: { ids: bulkIds, input: { dueDate: dateStr } } });
                      for (const id of bulkIds) {
                        cache.modify({
                          id: cache.identify({ __typename: "Task", id }),
                          fields: { dueDate: () => dateStr },
                        });
                      }
                      taskSelection?.clear();
                    }}
                  >
                    {t("tasks.dayAfterTomorrow")}
                  </ContextMenuItem>
                </ContextMenuSubContent>
              </ContextMenuSub>
              <ContextMenuSeparator />
              <ContextMenuItem
                variant="destructive"
                onClick={() => {
                  deleteTasks({ variables: { ids: bulkIds } });
                  for (const id of bulkIds) {
                    cache.evict({ id: cache.identify({ __typename: "Task", id }) });
                  }
                  cache.gc();
                  taskSelection?.clear();
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t("bulkDelete")}
              </ContextMenuItem>
            </>
          ) : (
            <>
              <ContextMenuSub>
                <ContextMenuSubTrigger>
                  <List className="mr-2 h-4 w-4" />
                  {t("tasks.moveTo")}
                </ContextMenuSubTrigger>
                <ContextMenuSubContent>
                  {allLists.map((list) => (
                    <ContextMenuItem
                      key={list.id}
                      disabled={list.id === task.list?.id}
                      onClick={() =>
                        updateTask({ variables: { id: task.id, input: { listId: list.id } } })
                      }
                    >
                      {list.name}
                    </ContextMenuItem>
                  ))}
                </ContextMenuSubContent>
              </ContextMenuSub>
              <ContextMenuSub>
                <ContextMenuSubTrigger>
                  <CalendarDays className="mr-2 h-4 w-4" />
                  {t("datePicker.dueDate")}
                </ContextMenuSubTrigger>
                <ContextMenuSubContent>
                  <ContextMenuItem onClick={() => setDueDate(0)}>
                    {t("tasks.today")}
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => setDueDate(1)}>
                    {t("tasks.tomorrow")}
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => setDueDate(2)}>
                    {t("tasks.dayAfterTomorrow")}
                  </ContextMenuItem>
                </ContextMenuSubContent>
              </ContextMenuSub>
              <ContextMenuItem
                onClick={() => {
                  convertTaskToList({ variables: { taskId: task.id } })
                    .then((res) => {
                      const newList = res.data?.convertTaskToList;
                      if (newList) {
                        router.push(`/lists/${newList.id}`);
                      }
                    })
                    .catch((err) => {
                      console.error(err);
                    });
                }}
              >
                <FolderOutput className="mr-2 h-4 w-4" />
                {t("tasks.convertToList")}
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="mr-2 h-4 w-4" />
                {t("common.deleteConfirmAction")}
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("common.deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("tasks.deleteConfirmDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.deleteConfirmCancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                deleteTask({ variables: { id: task.id } });
                // Close detail panel if it's showing this task
                if (selectedTaskId === task.id) {
                  const params = new URLSearchParams(searchParams.toString());
                  params.delete("task");
                  router.push(`?${params.toString()}`, { scroll: false });
                }
                onDelete?.();
              }}
            >
              {t("common.deleteConfirmAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
});
