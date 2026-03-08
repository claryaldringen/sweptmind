"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { gql } from "@apollo/client";
import { useQuery, useMutation } from "@apollo/client/react";
import { ArrowLeft, X } from "lucide-react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useGeocode } from "@/hooks/use-geocode";
import { useNearby } from "@/components/providers/nearby-provider";
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
import { DeviceContextPicker } from "@/components/ui/device-context-picker";

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
      }
      list {
        id
        name
      }
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

const GET_TAGS = gql`
  query GetTags {
    tags {
      id
      name
      color
    }
  }
`;

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

const GET_LOCATIONS = gql`
  query GetLocations {
    locations {
      id
      name
      latitude
      longitude
      address
    }
  }
`;

const CREATE_LOCATION = gql`
  mutation CreateLocation($input: CreateLocationInput!) {
    createLocation(input: $input) {
      id
      name
      latitude
      longitude
      address
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
  const { data: tagsData } = useQuery<{ tags: TaskTag[] }>(GET_TAGS, {
    skip: !taskId,
  });
  const { data: locationsData } = useQuery<{ locations: TaskLocation[] }>(GET_LOCATIONS, {
    skip: !taskId,
  });

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
        id: `temp-${Date.now()}`,
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
    refetchQueries: [{ query: GET_TAGS }],
  });
  const [addTagToTask] = useMutation<{ addTagToTask: boolean }>(ADD_TAG_TO_TASK, {
    update(cache, _result, { variables }) {
      if (!variables?.tagId || !taskId) return;
      const tagId = variables.tagId as string;
      const allTags = tagsData?.tags ?? [];
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
    refetchQueries: [{ query: GET_LOCATIONS }],
  });
  const [deleteLocation] = useMutation<{ deleteLocation: boolean }>(DELETE_LOCATION, {
    refetchQueries: [{ query: GET_LOCATIONS }],
  });

  // ---- Hooks ----

  const { isNearby: checkNearby, userLatitude, userLongitude } = useNearby();
  const geocode = useGeocode({ userLatitude, userLongitude, locale: appLocale });
  const isDesktop = useMediaQuery("(min-width: 768px)");

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

  function handleTitleBlur(e: React.FocusEvent<HTMLInputElement>) {
    const newTitle = e.target.value.trim();
    if (task && newTitle && newTitle !== task.title) {
      updateTask({ variables: { id: task.id, input: { title: newTitle } } });
    } else if (task) {
      e.target.value = task.title;
    }
  }

  function handleNotesBlur(e: React.FocusEvent<HTMLTextAreaElement>) {
    if (task && e.target.value !== (task.notes ?? "")) {
      updateTask({
        variables: { id: task.id, input: { notes: e.target.value || null } },
      });
    }
  }

  function handleDateSelect(date: Date | undefined) {
    if (!task) return;
    if (!date) {
      updateTask({ variables: { id: task.id, input: { dueDate: null } } });
      return;
    }
    const existingTime = task.dueDate?.includes("T") ? task.dueDate.split("T")[1] : null;
    const dateStr = format(date, "yyyy-MM-dd");
    const dueDate = existingTime ? `${dateStr}T${existingTime}` : dateStr;
    updateTask({ variables: { id: task.id, input: { dueDate } } });
  }

  function handleTimeChange(time: string) {
    if (!task || !task.dueDate) return;
    const dateStr = task.dueDate.split("T")[0];
    const dueDate = time ? `${dateStr}T${time}` : dateStr;
    updateTask({ variables: { id: task.id, input: { dueDate } } });
  }

  function handleReminderSelect(date: Date | undefined) {
    if (!task) return;
    if (!date) {
      updateTask({ variables: { id: task.id, input: { reminderAt: null } } });
      return;
    }
    const reminderAt = format(date, "yyyy-MM-dd");
    updateTask({ variables: { id: task.id, input: { reminderAt } } });
  }

  function handleDelete() {
    deleteTask({ variables: { id: taskId } });
    closePanel();
  }

  // Steps handlers

  async function handleAddStep(title: string) {
    if (!task) return;
    await createStep({
      variables: { input: { taskId: task.id, title } },
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
    const result = await createTag({
      variables: { input: { name } },
    });
    if (result.data?.createTag) {
      await addTagToTask({ variables: { taskId: task.id, tagId: result.data.createTag.id } });
    }
  }

  // Location handlers

  async function handleSelectLocation(locationId: string) {
    if (!task) return;
    await updateTask({
      variables: { id: task.id, input: { locationId } },
    });
  }

  async function handleSelectGeocodingResult(result: {
    display_name: string;
    lat: string;
    lon: string;
  }) {
    if (!task) return;
    const locationResult = await createLocation({
      variables: {
        input: {
          name: result.display_name.split(",")[0],
          latitude: parseFloat(result.lat),
          longitude: parseFloat(result.lon),
          address: result.display_name,
        },
      },
    });
    if (locationResult.data?.createLocation) {
      await updateTask({
        variables: {
          id: task.id,
          input: { locationId: locationResult.data.createLocation.id },
        },
      });
    }
  }

  async function handleRemoveLocation() {
    if (!task) return;
    await updateTask({
      variables: { id: task.id, input: { locationId: null } },
    });
  }

  // Recurrence handlers

  function formatRecurrence(recurrence: string | null): string | null {
    if (!recurrence) return null;
    if (recurrence === "DAILY") return t("recurrence.everyDay");
    if (recurrence === "MONTHLY") return t("recurrence.everyMonth");
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
    updateTask({ variables: { id: task.id, input: { recurrence: value } } });
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
      className={cn(
        "bg-background flex flex-col",
        isDesktop ? "w-96 border-l" : "absolute inset-0 z-10",
      )}
    >
      <div className="flex items-center justify-between p-4">
        <Button variant="ghost" size="icon" onClick={closePanel}>
          {isDesktop ? <X className="h-4 w-4" /> : <ArrowLeft className="h-5 w-5" />}
        </Button>
      </div>

      <div className="flex-1 space-y-4 overflow-auto px-4 pb-4">
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
            onClearDueDate={() =>
              updateTask({ variables: { id: task.id, input: { dueDate: null } } })
            }
            onReminderSelect={handleReminderSelect}
            onClearReminder={() =>
              updateTask({ variables: { id: task.id, input: { reminderAt: null } } })
            }
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
            yearlyLabel={t("recurrence.yearly")}
            removeRecurrenceLabel={t("recurrence.removeRecurrence")}
          />

          {/* Tags */}
          <TaskTags
            taskTags={task.tags ?? []}
            allTags={tagsData?.tags ?? []}
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
              (locationsData?.locations ?? []) as Array<{
                id: string;
                name: string;
                latitude: number;
                longitude: number;
                address?: string | null;
              }>
            }
            geocodeResults={geocode.results}
            onSearch={geocode.search}
            onClearSearch={geocode.clear}
            onSelectLocation={handleSelectLocation}
            onSelectGeocodingResult={handleSelectGeocodingResult}
            onRemoveLocation={handleRemoveLocation}
            onDeleteSavedLocation={(id) => deleteLocation({ variables: { id } })}
            checkNearby={checkNearby}
            addLocationLabel={t("tasks.addLocation")}
            searchLocationLabel={t("tasks.searchLocation")}
            savedLocationsLabel={t("tasks.savedLocations")}
            searchResultsLabel={t("tasks.searchResults")}
          />

          {/* Device Context */}
          <DeviceContextPicker
            value={task.deviceContext ?? null}
            onChange={(val) =>
              updateTask({
                variables: { id: task.id, input: { deviceContext: val } },
              })
            }
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
        createdLabel={t("tasks.created", {
          date: format(parseISO(task.createdAt), "EEE, MMM d", { locale: dateFnsLocale }),
        })}
        onDelete={handleDelete}
        deleteConfirmTitle={t("common.deleteConfirmTitle")}
        deleteConfirmDesc={t("tasks.deleteConfirmDesc")}
        deleteConfirmCancel={t("common.deleteConfirmCancel")}
        deleteConfirmAction={t("common.deleteConfirmAction")}
      />
    </div>
  );
}
