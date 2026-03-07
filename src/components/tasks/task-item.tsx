"use client";

import { memo, useState, type MouseEvent } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { gql } from "@apollo/client";
import { useMutation } from "@apollo/client/react";
import { useLists, GET_LISTS } from "@/components/providers/lists-provider";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bell,
  CalendarDays,
  FolderOutput,
  List,
  MapPin,
  Monitor,
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
}

interface Task {
  id: string;
  title: string;
  isCompleted: boolean;
  dueDate: string | null;
  reminderAt: string | null;
  recurrence?: string | null;
  locationId?: string | null;
  location?: TaskLocationInfo | null;
  list?: { id: string; name: string } | null;
  steps?: { id: string; isCompleted: boolean }[];
  tags?: TaskTag[];
}

interface TaskItemProps {
  task: Task;
  showListName?: boolean;
  onDelete?: () => void;
}

export const TaskItem = memo(function TaskItem({
  task,
  showListName = false,
  onDelete,
}: TaskItemProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, locale: appLocale } = useTranslations();
  const dateFnsLocale = appLocale === "cs" ? cs : enUS;
  const selectedTaskId = searchParams.get("task");
  const { isNearby: checkNearby } = useNearby();
  const deviceContext = useDeviceContext();
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const [localChecked, setLocalChecked] = useState<boolean | null>(null);
  const [prevIsCompleted, setPrevIsCompleted] = useState(task.isCompleted);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (prevIsCompleted !== task.isCompleted) {
    setPrevIsCompleted(task.isCompleted);
    if (localChecked !== null && task.isCompleted === localChecked) {
      setLocalChecked(null);
    }
  }

  const [toggleCompleted] = useMutation(TOGGLE_COMPLETED, {
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
      update(cache) {
        cache.evict({ id: cache.identify({ __typename: "Task", id: task.id }) });
        cache.gc();
      },
      refetchQueries: [{ query: GET_LISTS }],
    },
  );

  const completedSteps = task.steps?.filter((s) => s.isCompleted).length ?? 0;
  const totalSteps = task.steps?.length ?? 0;
  const hasTags = (task.tags?.length ?? 0) > 0;
  const isOverdue = task.dueDate && !task.isCompleted && isPast(startOfDay(parseISO(task.dueDate)));
  const hasReminder = !!task.reminderAt;
  const hasRecurrence = !!task.recurrence;
  const hasLocation = !!task.location;
  const locationNearby = task.location
    ? checkNearby(task.location.latitude, task.location.longitude)
    : false;
  const taskList = task.list ? lists.find((l) => l.id === task.list!.id) : undefined;
  const deviceMatch = !locationNearby && taskList?.deviceContext === deviceContext;
  const hasMetadata =
    (showListName && task.list) ||
    task.dueDate ||
    totalSteps > 0 ||
    hasTags ||
    hasReminder ||
    hasRecurrence ||
    hasLocation ||
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
            className={cn(
              "group hover:bg-accent flex cursor-pointer items-center gap-3 rounded-md px-4 py-2.5 transition-colors",
              selectedTaskId === task.id && "bg-accent",
              locationNearby && "bg-emerald-50 dark:bg-emerald-950/30",
              deviceMatch && "bg-yellow-50 dark:bg-yellow-950/30",
            )}
            onClick={handleClick}
          >
            <Checkbox
              checked={visuallyCompleted}
              onCheckedChange={() => {
                setLocalChecked(!visuallyCompleted);
                toggleCompleted({ variables: { id: task.id } });
              }}
              onClick={(e) => e.stopPropagation()}
              className="rounded-full"
            />
            <div className="min-w-0 flex-1">
              {isDesktop ? (
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
                        isOverdue ? "text-red-500" : "text-muted-foreground",
                      )}
                    >
                      <CalendarDays className="h-3 w-3" />
                      {format(
                        parseISO(task.dueDate),
                        task.dueDate.includes("T") ? "MMM d, h:mm a" : "MMM d",
                        { locale: dateFnsLocale },
                      )}
                    </span>
                  )}
                  {task.dueDate && (hasReminder || totalSteps > 0) && (
                    <span className="text-muted-foreground">·</span>
                  )}
                  {hasReminder && (
                    <span className="text-muted-foreground flex items-center gap-0.5">
                      <Bell className="h-3 w-3" />
                      {format(parseISO(task.reminderAt!), "MMM d", { locale: dateFnsLocale })}
                    </span>
                  )}
                  {hasReminder && (hasRecurrence || totalSteps > 0) && (
                    <span className="text-muted-foreground">·</span>
                  )}
                  {hasRecurrence && (
                    <span className="text-muted-foreground flex items-center gap-0.5">
                      <Repeat className="h-3 w-3" />
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
                  {deviceMatch &&
                    (hasLocation ||
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
