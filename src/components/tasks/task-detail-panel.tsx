"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { gql } from "@apollo/client";
import { useMutation, useApolloClient } from "@apollo/client/react";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { cs } from "date-fns/locale/cs";
import { enUS } from "date-fns/locale/en-US";
import { useTranslations } from "@/lib/i18n";
import { TaskSteps } from "./detail/task-steps";
import { TaskTags } from "./detail/task-tags";
import { TaskLocation } from "./detail/task-location";
import { TaskRecurrence } from "./detail/task-recurrence";
import { TaskDates } from "./detail/task-dates";
import { TaskActions } from "./detail/task-actions";
import { TaskDependency } from "./detail/task-dependency";
import { TaskAttachments } from "./detail/task-attachments";
import { TaskAiSection } from "./detail/task-ai-section";
import { TaskSharing } from "./detail/task-sharing";
import { TaskCompletionRules } from "./detail/task-completion-rules";
import { DeviceContextPicker } from "@/components/ui/device-context-picker";
import {
  computeFirstOccurrence,
  parseRecurrence,
  formatRecurrenceLabel,
} from "@/domain/services/recurrence";
import { pickNextTagColor } from "@/lib/tag-colors";
import { useIsPremium } from "@/hooks/use-is-premium";
import { useAppData } from "@/components/providers/app-data-provider";
import { useTaskDates } from "@/hooks/use-task-dates";
import { useApplyDecomposition } from "@/hooks/use-apply-decomposition";
import {
  TOGGLE_TASK_COMPLETED as TOGGLE_COMPLETED,
  DELETE_TASK,
} from "@/graphql/shared/task-mutations";
import { DELETE_LOCATION, CREATE_LOCATION } from "@/graphql/shared/location-mutations";

// ---------------------------------------------------------------------------
// GraphQL operations
// ---------------------------------------------------------------------------

const UPDATE_TASK = gql`
  mutation UpdateTask($id: String!, $input: UpdateTaskInput!) {
    updateTask(id: $id, input: $input) {
      id
      title
      notes
      dueDate
      dueDateEnd
      reminderAt
      recurrence
      deviceContext
      listId
      locationId
      locationRadius
      location {
        id
        name
        latitude
        longitude
        radius
      }
      blockedByTaskId
      blockedByTask {
        id
        title
      }
      shareCompletionMode
      shareCompletionAction
      shareCompletionListId
    }
  }
`;

const CREATE_STEP = gql`
  mutation CreateStep($input: CreateStepInput!) {
    createStep(input: $input) {
      id
      taskId
      title
      isCompleted
      sortOrder
    }
  }
`;

const TOGGLE_STEP = gql`
  mutation ToggleStepCompleted($id: String!) {
    toggleStepCompleted(id: $id) {
      id
      isCompleted
    }
  }
`;

const UPDATE_STEP = gql`
  mutation UpdateStep($id: String!, $title: String!) {
    updateStep(id: $id, title: $title) {
      id
      title
    }
  }
`;

const DELETE_STEP = gql`
  mutation DeleteStep($id: String!) {
    deleteStep(id: $id)
  }
`;

const REORDER_STEPS = gql`
  mutation ReorderSteps($taskId: String!, $input: [ReorderStepInput!]!) {
    reorderSteps(taskId: $taskId, input: $input)
  }
`;

// Tags and locations come from useAppData()

const CREATE_TAG = gql`
  mutation CreateTag($input: CreateTagInput!) {
    createTag(input: $input) {
      id
      name
      color
    }
  }
`;

const ADD_TAG_TO_TASK = gql`
  mutation AddTagToTask($taskId: String!, $tagId: String!) {
    addTagToTask(taskId: $taskId, tagId: $tagId)
  }
`;

const REMOVE_TAG_FROM_TASK = gql`
  mutation RemoveTagFromTask($taskId: String!, $tagId: String!) {
    removeTagFromTask(taskId: $taskId, tagId: $tagId)
  }
`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TaskStep {
  id: string;
  taskId: string;
  title: string;
  isCompleted: boolean;
  sortOrder: number;
}

interface TaskTag {
  id: string;
  name: string;
  color: string;
}

interface TaskLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
  address?: string | null;
}

interface TaskAttachment {
  id: string;
  taskId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
}

interface TaskDetail {
  id: string;
  listId: string;
  locationId: string | null;
  locationRadius: number | null;
  title: string;
  notes: string | null;
  isCompleted: boolean;
  completedAt: string | null;
  dueDate: string | null;
  dueDateEnd: string | null;
  reminderAt: string | null;
  recurrence: string | null;
  deviceContext: string | null;
  sortOrder: number;
  createdAt: string;
  steps: TaskStep[];
  tags: TaskTag[];
  location: TaskLocation | null;
  list: { id: string; name: string } | null;
  blockedByTaskId: string | null;
  blockedByTask: { id: string; title: string } | null;
  blockedByTaskIsCompleted: boolean | null;
  shareCompletionMode: string | null;
  shareCompletionAction: string | null;
  shareCompletionListId: string | null;
  isSharedTo: boolean;
  attachments: TaskAttachment[];
  aiAnalysis: {
    isActionable: boolean;
    suggestion: string | null;
    suggestedTitle: string | null;
    projectName: string | null;
    decomposition: { title: string; listName: string | null; dependsOn: number | null }[] | null;
    duplicateTaskId: string | null;
    callIntent: { name: string; reason: string | null } | null;
  } | null;
}

interface UpdateTaskData {
  updateTask: {
    id: string;
    title: string;
    notes: string | null;
    dueDate: string | null;
    dueDateEnd: string | null;
    reminderAt: string | null;
    recurrence: string | null;
    deviceContext: string | null;
    listId: string;
    locationId: string | null;
    locationRadius: number | null;
    location: TaskLocation | null;
    blockedByTaskId: string | null;
    blockedByTask: { id: string; title: string } | null;
    shareCompletionMode: string | null;
    shareCompletionAction: string | null;
    shareCompletionListId: string | null;
  };
}

interface ToggleCompletedData {
  toggleTaskCompleted: {
    __typename: "Task";
    id: string;
    isCompleted: boolean;
    completedAt: string | null;
    dueDate: string | null;
    dueDateEnd: string | null;
    reminderAt: string | null;
  };
}

interface DeleteTaskData {
  deleteTask: boolean;
}

interface CreateStepData {
  createStep: TaskStep;
}

interface ToggleStepData {
  toggleStepCompleted: { id: string; isCompleted: boolean };
}

interface DeleteStepData {
  deleteStep: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TaskDetailPanel() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t, tArray, locale: appLocale } = useTranslations();
  const dateFnsLocale = appLocale === "cs" ? cs : enUS;
  const taskId = searchParams.get("task");
  const showAi = searchParams.get("ai") === "1";

  // ---- Data ----

  const {
    allTasks,
    lists: allLists,
    tags: allTagsFromProvider,
    locations: allLocationsFromProvider,
    loading,
    conflictingTaskIds,
  } = useAppData();
  const { isPremium } = useIsPremium();
  const task = taskId
    ? ((allTasks.find((t) => t.id === taskId) as TaskDetail | undefined) ?? null)
    : null;

  const isConflicting = taskId ? conflictingTaskIds.has(taskId) : false;
  const conflictingWith =
    isConflicting && task?.dueDate
      ? allTasks.filter((t) => {
          if (t.id === taskId || !t.dueDate || t.isCompleted) return false;
          // Conflict only when both have a location and they differ
          if (!task.locationId || !t.locationId || task.locationId === t.locationId) return false;
          const interval = (d: string, dEnd: string | null) => {
            if (d.includes("T")) {
              const s = new Date(d).getTime();
              return { s, e: dEnd?.includes("T") ? new Date(dEnd).getTime() : s + 3600000 };
            }
            return {
              s: new Date(d + "T00:00:00").getTime(),
              e: new Date((dEnd ?? d) + "T23:59:59.999").getTime(),
            };
          };
          const a = interval(task.dueDate!, task.dueDateEnd ?? null);
          const b = interval(t.dueDate, t.dueDateEnd);
          return a.s < b.e && b.s < a.e;
        })
      : [];

  // ---- Mutations ----

  const [updateTask] = useMutation<UpdateTaskData>(UPDATE_TASK);
  const [toggleCompleted] = useMutation<ToggleCompletedData>(TOGGLE_COMPLETED, {
    optimisticResponse: {
      toggleTaskCompleted: {
        __typename: "Task" as const,
        id: taskId!,
        isCompleted: !task?.isCompleted,
        completedAt: task?.isCompleted ? null : new Date().toISOString(),
        dueDate: task?.dueDate ?? null,
        dueDateEnd: task?.dueDateEnd ?? null,
        reminderAt: task?.reminderAt ?? null,
      },
    },
    update(cache, { data }) {
      if (!data?.toggleTaskCompleted) return;
      const { id: completedId, isCompleted } = data.toggleTaskCompleted;
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
  const [deleteTask] = useMutation<DeleteTaskData>(DELETE_TASK, {
    update(cache) {
      cache.evict({
        id: cache.identify({ __typename: "Task", id: taskId }),
      });
      cache.gc();
    },
  });
  const [createStep] = useMutation<CreateStepData>(CREATE_STEP, {
    optimisticResponse: ({ input }) => ({
      createStep: {
        __typename: "Step" as const,
        id: input.id,
        taskId: input.taskId,
        title: input.title,
        isCompleted: false,
        sortOrder: task?.steps?.length ?? 0,
      },
    }),
    update(cache, { data }) {
      if (!data?.createStep || !taskId) return;
      cache.modify({
        id: cache.identify({ __typename: "Task", id: taskId }),
        fields: {
          steps(existing = []) {
            const newRef = cache.writeFragment({
              data: data.createStep,
              fragment: gql`
                fragment NewStep on Step {
                  id
                  taskId
                  title
                  isCompleted
                  sortOrder
                }
              `,
            });
            return [...existing, newRef];
          },
        },
      });
    },
  });
  const [toggleStep] = useMutation<ToggleStepData>(TOGGLE_STEP, {
    optimisticResponse: ({ id }) => {
      const step = task?.steps?.find((s) => s.id === id);
      return {
        toggleStepCompleted: {
          __typename: "Step" as const,
          id,
          isCompleted: !step?.isCompleted,
        },
      };
    },
  });
  const [updateStepTitle] = useMutation(UPDATE_STEP);
  const [deleteStep] = useMutation<DeleteStepData>(DELETE_STEP, {
    optimisticResponse: {
      deleteStep: true,
    },
    update(cache, _result, { variables }) {
      if (!variables?.id || !taskId) return;
      const stepId = variables.id as string;
      cache.modify({
        id: cache.identify({ __typename: "Task", id: taskId }),
        fields: {
          steps(existing = [], { readField }) {
            return existing.filter((ref: { __ref: string }) => readField("id", ref) !== stepId);
          },
        },
      });
      cache.evict({ id: cache.identify({ __typename: "Step", id: stepId }) });
      cache.gc();
    },
  });
  const [reorderSteps] = useMutation(REORDER_STEPS);

  const [createTag] = useMutation<{ createTag: TaskTag }>(CREATE_TAG, {
    update(cache, { data }) {
      if (!data?.createTag) return;
      cache.modify({
        fields: {
          tags(existing = []) {
            const newRef = cache.writeFragment({
              data: {
                ...data.createTag,
                taskCount: 0,
                deviceContext: null,
                locationId: null,
                location: null,
              },
              fragment: gql`
                fragment NewTag on Tag {
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
                    radius
                  }
                }
              `,
            });
            return [...existing, newRef];
          },
        },
      });
    },
  });
  const [addTagToTask] = useMutation<{ addTagToTask: boolean }>(ADD_TAG_TO_TASK, {
    update(cache, _result, { variables }) {
      if (!variables?.tagId || !taskId) return;
      const tagId = variables.tagId as string;
      // Read tag from cache (handles both existing and just-created tags)
      const tag = cache.readFragment<TaskTag>({
        id: cache.identify({ __typename: "Tag", id: tagId }),
        fragment: gql`
          fragment ReadTag on Tag {
            id
            name
            color
          }
        `,
      });
      if (!tag) return;
      cache.modify({
        id: cache.identify({ __typename: "Task", id: taskId }),
        fields: {
          tags(existing = []) {
            const newRef = cache.writeFragment({
              data: tag,
              fragment: gql`
                fragment TaskTag on Tag {
                  id
                  name
                  color
                }
              `,
            });
            return [...existing, newRef];
          },
        },
      });
    },
  });
  const [removeTagFromTask] = useMutation<{ removeTagFromTask: boolean }>(REMOVE_TAG_FROM_TASK, {
    update(cache, _result, { variables }) {
      if (!variables?.tagId || !taskId) return;
      const tagId = variables.tagId as string;
      cache.modify({
        id: cache.identify({ __typename: "Task", id: taskId }),
        fields: {
          tags(existing = [], { readField }) {
            return existing.filter((ref: { __ref: string }) => readField("id", ref) !== tagId);
          },
        },
      });
    },
  });
  const [createLocation] = useMutation<{ createLocation: TaskLocation }>(CREATE_LOCATION, {
    update(cache, { data }) {
      if (!data?.createLocation) return;
      cache.modify({
        fields: {
          locations(existing = []) {
            const newRef = cache.writeFragment({
              data: data.createLocation,
              fragment: gql`
                fragment NewLocation on Location {
                  id
                  name
                  latitude
                  longitude
                  radius
                  address
                }
              `,
            });
            return [...existing, newRef];
          },
        },
      });
    },
  });
  const [deleteLocation] = useMutation<{ deleteLocation: boolean }>(DELETE_LOCATION, {
    update(cache, _result, { variables }) {
      if (!variables?.id) return;
      cache.evict({ id: cache.identify({ __typename: "Location", id: variables.id }) });
      cache.gc();
    },
  });

  // ---- Hooks ----

  const isDesktop = useMediaQuery("(min-width: 768px)");
  const apolloClient = useApolloClient();

  function optimisticUpdate(input: Record<string, unknown>) {
    if (!task) return;
    // Write to cache immediately (instant UI) then fire mutation (network)
    apolloClient.cache.modify({
      id: apolloClient.cache.identify({ __typename: "Task", id: task.id }),
      fields: Object.fromEntries(Object.entries(input).map(([key, value]) => [key, () => value])),
    });
    updateTask({ variables: { id: task.id, input } });
  }

  const {
    handleDateSelect,
    handleTimeChange,
    handleReminderSelect,
    handleEndDateSelect,
    handleEndTimeChange,
    handleClearEndDate,
    handleQuickEndDate,
  } = useTaskDates({
    dueDate: task?.dueDate ?? null,
    dueDateEnd: task?.dueDateEnd ?? null,
    optimisticUpdate,
  });

  const { handleApplyDecomposition } = useApplyDecomposition({
    task,
    allTags: allTagsFromProvider,
    allLists,
    optimisticUpdate,
  });

  // ---- Early returns ----

  if (!taskId) return null;

  if (loading && !task) {
    return (
      <div
        className={cn("bg-background p-6", isDesktop ? "w-96 border-l" : "absolute inset-0 z-10")}
      >
        <div className="animate-pulse space-y-4">
          <div className="bg-muted h-6 w-3/4 rounded" />
          <div className="bg-muted h-4 w-1/2 rounded" />
          <div className="bg-muted h-20 rounded" />
        </div>
      </div>
    );
  }

  if (!task) return null;

  // ---- Handlers ----

  function closePanel() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("task");
    router.push(`?${params.toString()}`, { scroll: false });
  }

  function handleNotesBlur(e: React.FocusEvent<HTMLTextAreaElement>) {
    if (task && e.target.value !== (task.notes ?? "")) {
      optimisticUpdate({ notes: e.target.value || null });
    }
  }

  function handleDelete() {
    deleteTask({ variables: { id: taskId } });
    closePanel();
  }

  // Steps handlers

  async function handleAddStep(title: string) {
    if (!task) return;
    await createStep({
      variables: { input: { id: crypto.randomUUID(), taskId: task.id, title } },
    });
  }

  function handleReorderSteps(items: { id: string; sortOrder: number }[]) {
    if (!task) return;
    reorderSteps({
      variables: { taskId: task.id, input: items },
      optimisticResponse: { reorderSteps: true },
      update(cache) {
        for (const { id, sortOrder } of items) {
          cache.modify({
            id: cache.identify({ __typename: "Step", id }),
            fields: { sortOrder: () => sortOrder },
          });
        }
        // Also reorder the steps array on the parent Task to prevent snap-back
        cache.modify({
          id: cache.identify({ __typename: "Task", id: task.id }),
          fields: {
            steps(existing = [], { readField }) {
              return [...existing].sort((a: any, b: any) => {
                const aOrder = readField("sortOrder", a) as number;
                const bOrder = readField("sortOrder", b) as number;
                return aOrder - bOrder;
              });
            },
          },
        });
      },
    });
  }

  // Tags handlers

  async function handleAddTag(tagId: string) {
    if (!task) return;
    await addTagToTask({ variables: { taskId: task.id, tagId } });
  }

  async function handleRemoveTag(tagId: string) {
    if (!task) return;
    await removeTagFromTask({ variables: { taskId: task.id, tagId } });
  }

  async function handleCreateAndAddTag(name: string) {
    if (!task) return;
    const existingColors = allTagsFromProvider.map((t) => t.color);
    const color = pickNextTagColor(existingColors);
    const result = await createTag({
      variables: { input: { name, color } },
    });
    if (result.data?.createTag) {
      await addTagToTask({ variables: { taskId: task.id, tagId: result.data.createTag.id } });
    }
  }

  // Location handlers

  async function handleSelectLocation(locationId: string) {
    if (!task) return;
    optimisticUpdate({ locationId });
  }

  async function handleCreateLocation(loc: {
    name: string;
    latitude: number;
    longitude: number;
    radius?: number;
    address?: string | null;
  }) {
    if (!task) return;
    const locationResult = await createLocation({
      variables: { input: loc },
    });
    if (locationResult.data?.createLocation) {
      optimisticUpdate({ locationId: locationResult.data.createLocation.id });
    }
  }

  function handleUpdateLocationRadius(_id: string, radius: number) {
    if (!task) return;
    optimisticUpdate({ locationRadius: radius });
  }

  async function handleRemoveLocation() {
    if (!task) return;
    optimisticUpdate({ locationId: null });
  }

  // Dependency handler

  function handleSetDependency(blockedByTaskId: string | null) {
    if (!task) return;
    optimisticUpdate({ blockedByTaskId });
  }

  function handleDismissAi() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("ai");
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  // Recurrence handlers

  const recurrenceLabels = {
    everyDay: t("recurrence.everyDay"),
    everyNDays: (n: number) => t("recurrence.everyNDays", { n }),
    everyNWeeks: (n: number) => t("recurrence.everyNWeeks", { n }),
    everyMonth: t("recurrence.everyMonth"),
    everyNMonths: (n: number) => t("recurrence.everyNMonths", { n }),
    everyLastDay: t("recurrence.everyLastDay"),
    everyYear: t("recurrence.everyYear"),
    everyNYears: (n: number) => t("recurrence.everyNYears", { n }),
    daysShort: tArray("recurrence.daysShort"),
  };

  function handleSetRecurrence(value: string | null) {
    if (!task) return;
    if (value) {
      // Always recompute dueDate to match the new recurrence pattern
      const dueDate = computeFirstOccurrence(value);
      optimisticUpdate({ recurrence: value, dueDate });
    } else {
      optimisticUpdate({ recurrence: value });
    }
  }

  function handleToggleWeeklyDay(day: number) {
    if (!task) return;
    const parsed = task.recurrence ? parseRecurrence(task.recurrence) : null;
    const current = parsed?.type === "WEEKLY" ? parsed.days : [];
    const interval = parsed?.type === "WEEKLY" ? parsed.interval : 1;
    const updated = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day].sort((a, b) => a - b);
    if (updated.length === 0) {
      handleSetRecurrence(null);
    } else {
      const prefix = interval > 1 ? `WEEKLY:${interval}:` : "WEEKLY:";
      handleSetRecurrence(`${prefix}${updated.join(",")}`);
    }
  }

  // ---- Render ----

  // AI-only panel — show only when there's displayable content
  const ai = task.aiAnalysis;
  const hasAiContent =
    ai && (ai.suggestedTitle || ai.decomposition?.length || ai.duplicateTaskId || ai.callIntent);
  if (showAi && hasAiContent) {
    return (
      <div
        className={cn(
          "bg-background flex flex-col",
          isDesktop ? "h-full" : "absolute inset-0 z-10",
        )}
      >
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <Button variant="ghost" size="icon" onClick={handleDismissAi}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <span className="min-w-0 truncate text-sm font-medium">{task.title}</span>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <TaskAiSection
            key={task.id}
            taskId={task.id}
            suggestedTitle={ai.suggestedTitle}
            projectName={ai.projectName}
            decomposition={ai.decomposition}
            duplicateTaskId={ai.duplicateTaskId}
            duplicateTaskTitle={
              ai.duplicateTaskId
                ? (allTasks.find((t) => t.id === ai.duplicateTaskId)?.title ?? null)
                : null
            }
            callIntent={ai.callIntent}
            onApplyDecomposition={handleApplyDecomposition}
            onApplyRename={(title) => {
              optimisticUpdate({ title });
              handleDismissAi();
            }}
            onDeleteDuplicate={() => handleDelete()}
            onNavigateToDuplicate={(id) => {
              const params = new URLSearchParams(searchParams.toString());
              params.set("task", id);
              params.delete("ai");
              router.push(`?${params.toString()}`, { scroll: false });
            }}
            onDismiss={handleDismissAi}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn("bg-background flex flex-col", isDesktop ? "h-full" : "absolute inset-0 z-10")}
    >
      {!isDesktop && (
        <div className="flex items-center justify-between p-4">
          <Button variant="ghost" size="icon" onClick={closePanel}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </div>
      )}

      <div className="min-h-0 flex-1 space-y-4 overflow-auto px-4 pt-4 pb-4">
        {/* Title + Checkbox */}
        <div className="flex min-w-0 items-start gap-3">
          <Checkbox
            checked={task.isCompleted}
            onCheckedChange={() => toggleCompleted({ variables: { id: task.id } })}
            className="mt-1.5 shrink-0 rounded-full"
          />
          <textarea
            key={task.id + task.title}
            defaultValue={task.title}
            rows={1}
            ref={(el) => {
              if (el) el.style.height = el.scrollHeight + "px";
            }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = el.scrollHeight + "px";
            }}
            onBlur={(e) => {
              const newTitle = e.target.value.trim();
              if (task && newTitle && newTitle !== task.title) {
                optimisticUpdate({ title: newTitle });
              } else if (task) {
                e.target.value = task.title;
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.blur();
              }
              if (e.key === "Escape") {
                e.currentTarget.value = task.title;
                e.currentTarget.blur();
              }
            }}
            className={cn(
              "min-w-0 flex-1 resize-none overflow-hidden border-0 bg-transparent p-0 text-lg leading-tight font-medium shadow-none outline-none focus-visible:ring-0 md:text-lg",
              task.isCompleted && "text-muted-foreground line-through",
            )}
          />
        </div>

        {/* Steps */}
        <TaskSteps
          steps={task.steps ?? []}
          onAddStep={handleAddStep}
          onToggleStep={(id) => toggleStep({ variables: { id } })}
          onUpdateStepTitle={(id, title) => updateStepTitle({ variables: { id, title } })}
          onDeleteStep={(id) => deleteStep({ variables: { id } })}
          onReorderSteps={handleReorderSteps}
          addStepLabel={t("tasks.addStep")}
        />

        <Separator />

        {/* Actions */}
        <div className="space-y-1">
          {/* Due date + Reminder */}
          <TaskDates
            dueDate={task.dueDate}
            dueDateEnd={task.dueDateEnd}
            reminderAt={task.reminderAt}
            onDateSelect={handleDateSelect}
            onTimeChange={handleTimeChange}
            onClearDueDate={() => optimisticUpdate({ dueDate: null })}
            onReminderSelect={handleReminderSelect}
            onClearReminder={() => optimisticUpdate({ reminderAt: null })}
            onEndDateSelect={handleEndDateSelect}
            onEndTimeChange={handleEndTimeChange}
            onClearEndDate={handleClearEndDate}
            onQuickEndDate={handleQuickEndDate}
            t={t}
            dateFnsLocale={dateFnsLocale}
          />

          {/* Conflict warning */}
          {conflictingWith.length > 0 && (
            <div className="mx-4 flex items-start gap-2 rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-500">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {t("tasks.conflictWarning", {
                  tasks: conflictingWith.map((t) => t.title).join(", "),
                })}
              </span>
            </div>
          )}

          {/* Recurrence */}
          <TaskRecurrence
            recurrence={task.recurrence}
            onSetRecurrence={handleSetRecurrence}
            onToggleWeeklyDay={handleToggleWeeklyDay}
            formatRecurrence={(r) => formatRecurrenceLabel(r, recurrenceLabels)}
            daysShort={tArray("recurrence.daysShort")}
            addRecurrenceLabel={t("recurrence.addRecurrence")}
            dailyLabel={t("recurrence.daily")}
            weeklyLabel={t("recurrence.weekly")}
            monthlyLabel={t("recurrence.monthly")}
            monthlyLastLabel={t("recurrence.monthlyLast")}
            yearlyLabel={t("recurrence.yearly")}
            removeRecurrenceLabel={t("recurrence.removeRecurrence")}
            customLabel={t("recurrence.custom")}
            backLabel={t("recurrence.back")}
            doneLabel={t("recurrence.done")}
            everyLabel={t("recurrence.every")}
            unitLabels={{
              days: tArray("recurrence.unitDays"),
              weeks: tArray("recurrence.unitWeeks"),
              months: tArray("recurrence.unitMonths"),
              years: tArray("recurrence.unitYears"),
            }}
          />

          {/* Tags */}
          <TaskTags
            taskTags={task.tags ?? []}
            allTags={allTagsFromProvider}
            onAddTag={handleAddTag}
            onRemoveTag={handleRemoveTag}
            onCreateAndAddTag={handleCreateAndAddTag}
            addTagLabel={t("tasks.addTag")}
            searchOrCreateTagLabel={t("tasks.searchOrCreateTag")}
            createTagLabel={(name) => t("tasks.createTag", { name })}
          />

          {/* Location */}
          <TaskLocation
            location={
              task.location
                ? { ...task.location, radius: task.locationRadius ?? task.location.radius }
                : null
            }
            savedLocations={
              allLocationsFromProvider as Array<{
                id: string;
                name: string;
                latitude: number;
                longitude: number;
                radius: number;
                address?: string | null;
              }>
            }
            onSelectLocation={handleSelectLocation}
            onCreateLocation={handleCreateLocation}
            onRemoveLocation={handleRemoveLocation}
            onDeleteSavedLocation={(id) => deleteLocation({ variables: { id } })}
            onUpdateLocationRadius={handleUpdateLocationRadius}
          />

          {/* Device Context */}
          <DeviceContextPicker
            value={task.deviceContext ?? null}
            onChange={(val) => optimisticUpdate({ deviceContext: val })}
          />

          {/* Dependency */}
          <TaskDependency
            taskId={task.id}
            blockedByTask={task.blockedByTask ?? null}
            tagIds={(task.tags ?? []).map((t) => t.id)}
            onSetDependency={handleSetDependency}
            onNavigateToTask={(id) => {
              const params = new URLSearchParams(searchParams.toString());
              params.set("task", id);
              router.push(`?${params.toString()}`, { scroll: false });
            }}
          />
        </div>

        <Separator />

        {/* Sharing */}
        <TaskSharing taskId={task.id} />

        {/* Completion rules — only for tasks shared to others */}
        {task.isSharedTo && (
          <TaskCompletionRules
            mode={task.shareCompletionMode}
            action={task.shareCompletionAction}
            listId={task.shareCompletionListId}
            lists={allLists}
            onModeChange={(mode) => optimisticUpdate({ shareCompletionMode: mode })}
            onActionChange={(action) => optimisticUpdate({ shareCompletionAction: action })}
            onListChange={(listId) => optimisticUpdate({ shareCompletionListId: listId })}
          />
        )}

        <Separator />

        {/* Notes */}
        <Textarea
          placeholder={t("tasks.addNote")}
          defaultValue={task.notes ?? ""}
          onBlur={handleNotesBlur}
          className="min-h-[100px] resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
        />

        {/* Attachments */}
        <TaskAttachments
          taskId={task.id}
          attachments={task.attachments ?? []}
          isPremium={isPremium}
          uploadLabel={t("premium.uploadFile")}
          deleteLabel={t("premium.deleteFile")}
          downloadLabel={t("premium.downloadFile")}
          premiumRequiredLabel={t("premium.premiumRequired")}
          premiumRequiredDesc={t("premium.premiumRequiredDesc")}
          fileTooLargeLabel={t("premium.fileTooLarge")}
          storageFullLabel={t("premium.storageFull")}
          dragDropHintLabel={t("premium.dragDropHint")}
          uploadingLabel={t("premium.uploading")}
          deleteConfirmTitle={t("common.deleteConfirmTitle")}
          deleteConfirmDesc={t("premium.deleteFileConfirmDesc")}
          deleteConfirmCancel={t("common.deleteConfirmCancel")}
          deleteConfirmAction={t("common.deleteConfirmAction")}
        />
      </div>

      {/* Footer */}
      <TaskActions
        onClose={isDesktop ? closePanel : undefined}
        createdLabel={
          task.createdAt
            ? t("tasks.created", {
                date: format(parseISO(task.createdAt), "EEE, MMM d", { locale: dateFnsLocale }),
              })
            : ""
        }
        onDelete={handleDelete}
        deleteConfirmTitle={t("common.deleteConfirmTitle")}
        deleteConfirmDesc={t("tasks.deleteConfirmDesc")}
        deleteConfirmCancel={t("common.deleteConfirmCancel")}
        deleteConfirmAction={t("common.deleteConfirmAction")}
      />
    </div>
  );
}
