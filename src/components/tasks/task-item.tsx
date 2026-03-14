"use client";

import { memo, useState, useEffect, useRef, type MouseEvent } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { gql } from "@apollo/client";
import { useMutation } from "@apollo/client/react";
import { useLists } from "@/components/providers/app-data-provider";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bell,
  CalendarDays,
  FolderOutput,
  Lightbulb,
  Link2,
  List,
  Lock,
  MapPin,
  Monitor,
  Paperclip,
  Repeat,
  Smartphone,
  Trash2,
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
import { getTagColorClasses } from "@/lib/tag-colors";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { format, isPast, parseISO, startOfDay, addDays } from "date-fns";
import { cs } from "date-fns/locale/cs";
import { enUS } from "date-fns/locale/en-US";
import { useTranslations } from "@/lib/i18n";
import { useNearby } from "@/components/providers/nearby-provider";
import { useDeviceContext } from "@/hooks/use-device-context";

const TOGGLE_COMPLETED = gql`
  mutation ToggleTaskCompleted($id: String!) {
    toggleTaskCompleted(id: $id) {
      id
      isCompleted
      completedAt
      dueDate
      reminderAt
    }
  }
`;

const UPDATE_TASK = gql`
  mutation UpdateTask($id: String!, $input: UpdateTaskInput!) {
    updateTask(id: $id, input: $input) {
      id
      title
      dueDate
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

const DELETE_TASK = gql`
  mutation DeleteTask($id: String!) {
    deleteTask(id: $id)
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

interface TaskTag {
  id: string;
  name: string;
  color: string;
}

interface TaskLocationInfo {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
}

interface Task {
  id: string;
  title: string;
  isCompleted: boolean;
  dueDate: string | null;
  reminderAt: string | null;
  recurrence?: string | null;
  locationId?: string | null;
  locationRadius?: number | null;
  location?: TaskLocationInfo | null;
  list?: { id: string; name: string } | null;
  steps?: { id: string; isCompleted: boolean }[];
  tags?: TaskTag[];
  blockedByTaskId?: string | null;
  blockedByTaskIsCompleted?: boolean | null;
  dependentTaskCount?: number;
  attachments?: { id: string }[];
  aiAnalysis?: {
    isActionable: boolean;
    suggestion: string | null;
    analyzedTitle: string;
  } | null;
}

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
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const [localChecked, setLocalChecked] = useState<boolean | null>(null);
  const [prevIsCompleted, setPrevIsCompleted] = useState(task.isCompleted);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const completionTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    return () => completionTimersRef.current.forEach(clearTimeout);
  }, []);

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
        reminderAt: task.reminderAt,
      },
    },
    update(cache, { data }) {
      if (!data?.toggleTaskCompleted) return;
      const { id: completedId, isCompleted } = data.toggleTaskCompleted;
      // Update blockedByTaskIsCompleted on all tasks that depend on this one
      cache.modify({
        fields: {
          visibleTasks(existing = [], { readField }) {
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

  const completedSteps = task.steps?.filter((s) => s.isCompleted).length ?? 0;
  const totalSteps = task.steps?.length ?? 0;
  const hasTags = (task.tags?.length ?? 0) > 0;
  const dueDateParsed = task.dueDate ? parseISO(task.dueDate) : null;
  const localToday = format(new Date(), "yyyy-MM-dd");
  const isDueToday = task.dueDate?.split("T")[0] === localToday;
  const isOverdue =
    dueDateParsed && !task.isCompleted && !isDueToday && isPast(startOfDay(dueDateParsed));
  const hasReminder = !!task.reminderAt;
  const isReminderToday = task.reminderAt?.split("T")[0] === localToday;
  const hasRecurrence = !!task.recurrence;
  const hasLocation = !!task.location;
  const locationNearby = task.location
    ? checkNearby(
        task.location.latitude,
        task.location.longitude,
        task.locationRadius ?? task.location.radius,
      )
    : false;
  const taskList = task.list ? lists.find((l) => l.id === task.list!.id) : undefined;
  const deviceMatch = !locationNearby && taskList?.deviceContext === deviceContext;
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
    deviceMatch;

  const allLists = lists;

  function handleClick() {
    const params = new URLSearchParams(searchParams.toString());
    params.set("task", task.id);
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
              selectedTaskId === task.id && "bg-accent",
              locationNearby && "bg-emerald-50 dark:bg-emerald-950/30",
              deviceMatch && "bg-yellow-50 dark:bg-yellow-950/30",
              (fadingOut || externalFadingOut) && "opacity-0",
            )}
            onClick={handleClick}
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
              {isDesktop && selectedTaskId === task.id ? (
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
                    "block truncate text-sm",
                    visuallyCompleted && "text-muted-foreground line-through",
                  )}
                >
                  {task.title}
                </span>
              )}
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
                          ? "text-red-500"
                          : isDueToday
                            ? "text-blue-500"
                            : "text-muted-foreground",
                      )}
                    >
                      <CalendarDays className="h-3 w-3" />
                      {isDueToday
                        ? t("tasks.today")
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
                  {/* AI Analysis — not actionable indicator */}
                  {task.aiAnalysis && !task.aiAnalysis.isActionable && (
                    <>
                      <span className="text-muted-foreground">·</span>
                      <span
                        className="flex items-center gap-0.5 text-yellow-500"
                        title={task.aiAnalysis.suggestion ?? t("premium.aiNotActionable")}
                      >
                        <Lightbulb className="h-3 w-3" />
                      </span>
                    </>
                  )}
                  {/* AI Analysis — loading indicator */}
                  {analyzingTaskIds?.has(task.id) && !task.aiAnalysis && (
                    <>
                      <span className="text-muted-foreground">·</span>
                      <span
                        className="flex items-center gap-0.5 text-yellow-500/50"
                        title={t("premium.aiAnalyzing")}
                      >
                        <Lightbulb className="h-3 w-3 animate-pulse" />
                      </span>
                    </>
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
                </div>
              )}
            </div>
            <Trash2
              className={cn(
                "text-muted-foreground h-4 w-4 cursor-pointer transition-opacity",
                isDesktop ? "opacity-0 group-hover:opacity-100" : "opacity-60",
              )}
              onClick={(e) => {
                e.stopPropagation();
                setDeleteOpen(true);
              }}
            />
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
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
              <ContextMenuItem onClick={() => setDueDate(0)}>{t("tasks.today")}</ContextMenuItem>
              <ContextMenuItem onClick={() => setDueDate(1)}>{t("tasks.tomorrow")}</ContextMenuItem>
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
