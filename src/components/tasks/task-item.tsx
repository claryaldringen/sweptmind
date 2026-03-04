"use client";

import { useState, useEffect } from "react";
import { gql } from "@apollo/client";
import { useMutation } from "@apollo/client/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bell, CalendarDays, MapPin, Repeat, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getTagColorClasses } from "@/lib/tag-colors";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, isPast, parseISO, startOfDay } from "date-fns";
import { cs } from "date-fns/locale/cs";
import { enUS } from "date-fns/locale/en-US";
import { useTranslations } from "@/lib/i18n";
import { useNearby } from "@/components/providers/nearby-provider";

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

const DELETE_TASK = gql`
  mutation DeleteTask($id: String!) {
    deleteTask(id: $id)
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

export function TaskItem({ task, showListName = false, onDelete }: TaskItemProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale: appLocale } = useTranslations();
  const dateFnsLocale = appLocale === "cs" ? cs : enUS;
  const selectedTaskId = searchParams.get("task");
  const { isNearby: checkNearby } = useNearby();

  const [localChecked, setLocalChecked] = useState<boolean | null>(null);

  useEffect(() => {
    if (localChecked !== null && task.isCompleted === localChecked) {
      setLocalChecked(null);
    }
  }, [task.isCompleted, localChecked]);

  const [toggleCompleted] = useMutation(TOGGLE_COMPLETED);

  const visuallyCompleted = localChecked ?? task.isCompleted;


  const [updateTask] = useMutation(UPDATE_TASK);
  const [deleteTask] = useMutation<{ deleteTask: boolean }>(DELETE_TASK, {
    update(cache) {
      cache.evict({ id: cache.identify({ __typename: "Task", id: task.id }) });
      cache.gc();
    },
  });

  const completedSteps = task.steps?.filter((s) => s.isCompleted).length ?? 0;
  const totalSteps = task.steps?.length ?? 0;
  const hasTags = (task.tags?.length ?? 0) > 0;
  const isOverdue = task.dueDate && !task.isCompleted && isPast(startOfDay(parseISO(task.dueDate)));
  const hasReminder = !!task.reminderAt;
  const hasRecurrence = !!task.recurrence;
  const hasLocation = !!task.location;
  const locationNearby = task.location ? checkNearby(task.location.latitude, task.location.longitude) : false;
  const hasMetadata =
    (showListName && task.list) || task.dueDate || totalSteps > 0 || hasTags || hasReminder || hasRecurrence || hasLocation;

  function handleClick() {
    const params = new URLSearchParams(searchParams.toString());
    params.set("task", task.id);
    router.push(`?${params.toString()}`, { scroll: false });
  }

  return (
    <div
      className={cn(
        "group hover:bg-accent flex cursor-pointer items-center gap-3 rounded-md px-4 py-2.5 transition-colors",
        selectedTaskId === task.id && "bg-accent",
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
        <input
          key={task.id + task.title}
          defaultValue={task.title}
          size={task.title.length || 1}
          onClick={(e) => e.stopPropagation()}
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
            "min-w-0 max-w-full bg-transparent text-sm outline-none",
            visuallyCompleted && "text-muted-foreground line-through",
          )}
        />
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
                {format(parseISO(task.dueDate), task.dueDate.includes("T") ? "MMM d, h:mm a" : "MMM d", { locale: dateFnsLocale })}
              </span>
            )}
            {task.dueDate && (hasReminder || totalSteps > 0) && <span className="text-muted-foreground">·</span>}
            {hasReminder && (
              <span className="text-muted-foreground flex items-center gap-0.5">
                <Bell className="h-3 w-3" />
                {format(parseISO(task.reminderAt!), "MMM d", { locale: dateFnsLocale })}
              </span>
            )}
            {hasReminder && (hasRecurrence || totalSteps > 0) && <span className="text-muted-foreground">·</span>}
            {hasRecurrence && (
              <span className="text-muted-foreground flex items-center gap-0.5">
                <Repeat className="h-3 w-3" />
              </span>
            )}
            {hasRecurrence && totalSteps > 0 && <span className="text-muted-foreground">·</span>}
            {totalSteps > 0 && (
              <span className="text-muted-foreground">
                {completedSteps}/{totalSteps}
              </span>
            )}
            {hasTags &&
              (totalSteps > 0 ||
                task.dueDate ||
                (showListName && task.list)) && <span className="text-muted-foreground">·</span>}
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
            {hasLocation && (hasTags || totalSteps > 0 || task.dueDate || hasReminder || (showListName && task.list)) && (
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
                  className="rounded-full p-0.5 opacity-0 transition-opacity hover:bg-black/10 group-hover/loc:opacity-100 dark:hover:bg-white/10"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            )}
          </div>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 opacity-0 group-hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          deleteTask({ variables: { id: task.id } });
          onDelete?.();
        }}
      >
        <Trash2 className="text-muted-foreground h-4 w-4" />
      </Button>
    </div>
  );
}
