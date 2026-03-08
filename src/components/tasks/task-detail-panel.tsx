"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { gql } from "@apollo/client";
import { useQuery, useMutation, useApolloClient } from "@apollo/client/react";
import { ArrowLeft } from "lucide-react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { DeviceContextPicker } from "@/components/ui/device-context-picker";
import { computeFirstOccurrence } from "@/domain/services/recurrence";
import { pickNextTagColor } from "@/lib/tag-colors";
import { useAppData } from "@/components/providers/app-data-provider";

// ---------------------------------------------------------------------------
// GraphQL operations
// ---------------------------------------------------------------------------

const GET_TASK = gql`
  query GetTask($id: String!) {
    task(id: $id) {
      id
      listId
      locationId
      title
      notes
      isCompleted
      completedAt
      dueDate
      reminderAt
      recurrence
      deviceContext
      sortOrder
      createdAt
      steps {
        id
        taskId
        title
        isCompleted
        sortOrder
      }
      tags {
        id
        name
        color
      }
      location {
        id
        name
        latitude
        longitude
        radius
      }
      list {
        id
        name
      }
      blockedByTaskId
      blockedByTask {
        id
        title
      }
      blockedByTaskIsCompleted
    }
  }
`;

const UPDATE_TASK = gql`
  mutation UpdateTask($id: String!, $input: UpdateTaskInput!) {
    updateTask(id: $id, input: $input) {
      id
      title
      notes
      dueDate
      reminderAt
      recurrence
      deviceContext
      listId
      locationId
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
    }
  }
`;

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

const DELETE_TASK = gql`
  mutation DeleteTask($id: String!) {
    deleteTask(id: $id)
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


const CREATE_LOCATION = gql`
  mutation CreateLocation($input: CreateLocationInput!) {
    createLocation(input: $input) {
      id
      name
      latitude
      longitude
      radius
      address
    }
  }
`;

const UPDATE_LOCATION = gql`
  mutation UpdateLocation($id: String!, $input: UpdateLocationInput!) {
    updateLocation(id: $id, input: $input) {
      id
      radius
    }
  }
`;

const DELETE_LOCATION = gql`
  mutation DeleteLocation($id: String!) {
    deleteLocation(id: $id)
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

interface TaskDetail {
  id: string;
  listId: string;
  locationId: string | null;
  title: string;
  notes: string | null;
  isCompleted: boolean;
  completedAt: string | null;
  dueDate: string | null;
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
}

interface GetTaskData {
  task: TaskDetail | null;
}

interface UpdateTaskData {
  updateTask: {
    id: string;
    title: string;
    notes: string | null;
    dueDate: string | null;
    reminderAt: string | null;
    recurrence: string | null;
    deviceContext: string | null;
    listId: string;
    locationId: string | null;
    location: TaskLocation | null;
    blockedByTaskId: string | null;
    blockedByTask: { id: string; title: string } | null;
  };
}

interface ToggleCompletedData {
  toggleTaskCompleted: {
    __typename: "Task";
    id: string;
    isCompleted: boolean;
    completedAt: string | null;
    dueDate: string | null;
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

  // ---- Queries ----

  const { data, loading, error } = useQuery<GetTaskData>(GET_TASK, {
    variables: { id: taskId! },
    skip: !taskId,
    fetchPolicy: "cache-and-network",
    returnPartialData: true,
  });
  const { tags: allTagsFromProvider, locations: allLocationsFromProvider } = useAppData();

  // ---- Mutations ----

  const [updateTask] = useMutation<UpdateTaskData>(UPDATE_TASK);
  const [toggleCompleted] = useMutation<ToggleCompletedData>(TOGGLE_COMPLETED, {
    optimisticResponse: {
      toggleTaskCompleted: {
        __typename: "Task" as const,
        id: taskId!,
        isCompleted: !data?.task?.isCompleted,
        completedAt: data?.task?.isCompleted ? null : new Date().toISOString(),
        dueDate: data?.task?.dueDate ?? null,
        reminderAt: data?.task?.reminderAt ?? null,
      },
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
        sortOrder: data?.task?.steps?.length ?? 0,
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
      const step = data?.task?.steps?.find((s) => s.id === id);
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
  const [createTag] = useMutation<{ createTag: TaskTag }>(CREATE_TAG, {
    update(cache, { data }) {
      if (!data?.createTag) return;
      cache.modify({
        fields: {
          tags(existing = []) {
            const newRef = cache.writeFragment({
              data: data.createTag,
              fragment: gql`
                fragment NewTag on Tag {
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
  const [addTagToTask] = useMutation<{ addTagToTask: boolean }>(ADD_TAG_TO_TASK, {
    update(cache, _result, { variables }) {
      if (!variables?.tagId || !taskId) return;
      const tagId = variables.tagId as string;
      const allTags = allTagsFromProvider;
      const tag = allTags.find((t) => t.id === tagId);
      if (!tag) return;
      cache.modify({
        id: cache.identify({ __typename: "Task", id: taskId }),
        fields: {
          tags(existing = []) {
            const newRef = cache.writeFragment({
              data: tag,
              fragment: gql`
                fragment NewTag on Tag {
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
  const [updateLocation] = useMutation(UPDATE_LOCATION);

  // ---- Hooks ----

  const isDesktop = useMediaQuery("(min-width: 768px)");
  const apolloClient = useApolloClient();

  // ---- Early returns ----

  if (!taskId) return null;

  // returnPartialData makes types DeepPartial — cast after null check since
  // core fields are always present from the list query cache
  const task = data?.task as TaskDetail | null | undefined;

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

  if (error && !task) {
    return <div className="p-4 text-red-500">Failed to load task</div>;
  }

  if (!task) return null;

  // ---- Handlers ----

  function closePanel() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("task");
    router.push(`?${params.toString()}`, { scroll: false });
  }

  function optimisticUpdate(input: Record<string, unknown>) {
    if (!task) return;
    // Write to cache immediately (instant UI) then fire mutation (network)
    apolloClient.cache.modify({
      id: apolloClient.cache.identify({ __typename: "Task", id: task.id }),
      fields: Object.fromEntries(Object.entries(input).map(([key, value]) => [key, () => value])),
    });
    updateTask({ variables: { id: task.id, input } });
  }

  function handleTitleBlur(e: React.FocusEvent<HTMLInputElement>) {
    const newTitle = e.target.value.trim();
    if (task && newTitle && newTitle !== task.title) {
      optimisticUpdate({ title: newTitle });
    } else if (task) {
      e.target.value = task.title;
    }
  }

  function handleNotesBlur(e: React.FocusEvent<HTMLTextAreaElement>) {
    if (task && e.target.value !== (task.notes ?? "")) {
      optimisticUpdate({ notes: e.target.value || null });
    }
  }

  function handleDateSelect(date: Date | undefined) {
    if (!task) return;
    if (!date) {
      optimisticUpdate({ dueDate: null });
      return;
    }
    const existingTime = task.dueDate?.includes("T") ? task.dueDate.split("T")[1] : null;
    const dateStr = format(date, "yyyy-MM-dd");
    const dueDate = existingTime ? `${dateStr}T${existingTime}` : dateStr;
    optimisticUpdate({ dueDate });
  }

  function handleTimeChange(time: string) {
    if (!task || !task.dueDate) return;
    const dateStr = task.dueDate.split("T")[0];
    const dueDate = time ? `${dateStr}T${time}` : dateStr;
    optimisticUpdate({ dueDate });
  }

  function handleReminderSelect(date: Date | undefined) {
    if (!task) return;
    if (!date) {
      optimisticUpdate({ reminderAt: null });
      return;
    }
    const reminderAt = format(date, "yyyy-MM-dd");
    optimisticUpdate({ reminderAt });
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
    const existingColors = (allTagsFromProvider).map((t) => t.color);
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

  function handleUpdateLocationRadius(id: string, radius: number) {
    updateLocation({ variables: { id, input: { radius } } });
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

  // Recurrence handlers

  function formatRecurrence(recurrence: string | null): string | null {
    if (!recurrence) return null;
    if (recurrence === "DAILY") return t("recurrence.everyDay");
    if (recurrence === "MONTHLY") return t("recurrence.everyMonth");
    if (recurrence === "MONTHLY_LAST") return t("recurrence.everyLastDay");
    if (recurrence === "YEARLY") return t("recurrence.everyYear");
    if (recurrence.startsWith("WEEKLY:")) {
      const days = recurrence.slice(7).split(",").map(Number);
      const dayNames = tArray("recurrence.daysShort");
      if (days.length === 7) return t("recurrence.everyDay");
      return days.map((d) => dayNames[d]).join(", ");
    }
    return null;
  }

  function handleSetRecurrence(value: string | null) {
    if (!task) return;
    if (value) {
      // Only set dueDate if the task doesn't already have one
      if (task.dueDate) {
        optimisticUpdate({ recurrence: value });
      } else {
        const dueDate = computeFirstOccurrence(value);
        optimisticUpdate({ recurrence: value, dueDate });
      }
    } else {
      optimisticUpdate({ recurrence: value });
    }
  }

  function handleToggleWeeklyDay(day: number) {
    if (!task) return;
    const current = task.recurrence?.startsWith("WEEKLY:")
      ? task.recurrence.slice(7).split(",").map(Number)
      : [];
    const updated = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day].sort((a, b) => a - b);
    if (updated.length === 0) {
      handleSetRecurrence(null);
    } else {
      handleSetRecurrence(`WEEKLY:${updated.join(",")}`);
    }
  }

  // ---- Render ----

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

      <div className="flex-1 space-y-4 overflow-auto px-4 pt-4 pb-4">
        {/* Title + Checkbox */}
        <div className="flex items-start gap-3">
          <Checkbox
            checked={task.isCompleted}
            onCheckedChange={() => toggleCompleted({ variables: { id: task.id } })}
            className="mt-1.5 rounded-full"
          />
          <Input
            key={task.id + task.title}
            defaultValue={task.title}
            onBlur={handleTitleBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                e.currentTarget.value = task.title;
                e.currentTarget.blur();
              }
            }}
            className={cn(
              "h-auto border-0 bg-transparent p-0 text-lg leading-tight font-medium shadow-none outline-none focus-visible:ring-0 md:text-lg",
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
          addStepLabel={t("tasks.addStep")}
        />

        <Separator />

        {/* Actions */}
        <div className="space-y-1">
          {/* Due date + Reminder */}
          <TaskDates
            dueDate={task.dueDate}
            reminderAt={task.reminderAt}
            onDateSelect={handleDateSelect}
            onTimeChange={handleTimeChange}
            onClearDueDate={() => optimisticUpdate({ dueDate: null })}
            onReminderSelect={handleReminderSelect}
            onClearReminder={() => optimisticUpdate({ reminderAt: null })}
            t={t}
            dateFnsLocale={dateFnsLocale}
          />

          {/* Recurrence */}
          <TaskRecurrence
            recurrence={task.recurrence}
            onSetRecurrence={handleSetRecurrence}
            onToggleWeeklyDay={handleToggleWeeklyDay}
            formatRecurrence={formatRecurrence}
            daysShort={tArray("recurrence.daysShort")}
            addRecurrenceLabel={t("recurrence.addRecurrence")}
            dailyLabel={t("recurrence.daily")}
            weeklyLabel={t("recurrence.weekly")}
            monthlyLabel={t("recurrence.monthly")}
            monthlyLastLabel={t("recurrence.monthlyLast")}
            yearlyLabel={t("recurrence.yearly")}
            removeRecurrenceLabel={t("recurrence.removeRecurrence")}
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
            location={task.location}
            savedLocations={
              (allLocationsFromProvider) as Array<{
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

        {/* Notes */}
        <Textarea
          placeholder={t("tasks.addNote")}
          defaultValue={task.notes ?? ""}
          onBlur={handleNotesBlur}
          className="min-h-[100px] resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
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
