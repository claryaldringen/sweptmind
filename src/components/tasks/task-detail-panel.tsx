"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { gql } from "@apollo/client";
import { useMutation, useQuery, useApolloClient } from "@apollo/client/react";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { format, parseISO, addHours, addDays } from "date-fns";
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
import { DeviceContextPicker } from "@/components/ui/device-context-picker";
import { computeFirstOccurrence, parseRecurrence } from "@/domain/services/recurrence";
import { pickNextTagColor } from "@/lib/tag-colors";
import { useAppData } from "@/components/providers/app-data-provider";

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
      dueDateEnd
      reminderAt
    }
  }
`;

const DELETE_TASK = gql`
  mutation DeleteTask($id: String!) {
    deleteTask(id: $id)
  }
`;

const CREATE_TASK = gql`
  mutation CreateTask($input: CreateTaskInput!) {
    createTask(input: $input) {
      id
      listId
      title
      notes
      isCompleted
      dueDate
      dueDateEnd
      sortOrder
      createdAt
      steps {
        id
        taskId
        title
        isCompleted
        sortOrder
      }
    }
  }
`;

const MARK_TASKS_ACTIONABLE = gql`
  mutation MarkTasksActionable($taskIds: [String!]!) {
    markTasksActionable(taskIds: $taskIds)
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

const DELETE_LOCATION = gql`
  mutation DeleteLocation($id: String!) {
    deleteLocation(id: $id)
  }
`;

const GET_ME = gql`
  query GetMe {
    me {
      id
      name
      email
      image
      isPremium
    }
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

interface GetMeData {
  me: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    isPremium: boolean;
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
  const { data: meData } = useQuery<GetMeData>(GET_ME);
  const isPremium = meData?.me?.isPremium ?? false;
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

  const [createTask] = useMutation<{
    createTask: {
      id: string;
      listId: string;
      title: string;
      notes: string | null;
      isCompleted: boolean;
      dueDate: string | null;
      dueDateEnd: string | null;
      sortOrder: number;
      createdAt: string;
      steps: TaskStep[];
    };
  }>(CREATE_TASK);
  const [markTasksActionable] = useMutation(MARK_TASKS_ACTIONABLE);

  // ---- Hooks ----

  const isDesktop = useMediaQuery("(min-width: 768px)");
  const apolloClient = useApolloClient();

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

  function optimisticUpdate(input: Record<string, unknown>) {
    if (!task) return;
    // Write to cache immediately (instant UI) then fire mutation (network)
    apolloClient.cache.modify({
      id: apolloClient.cache.identify({ __typename: "Task", id: task.id }),
      fields: Object.fromEntries(Object.entries(input).map(([key, value]) => [key, () => value])),
    });
    updateTask({ variables: { id: task.id, input } });
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

  function handleEndDateSelect(date: Date | undefined) {
    if (!date) return;
    optimisticUpdate({ dueDateEnd: format(date, "yyyy-MM-dd") });
  }

  function handleEndTimeChange(time: string) {
    if (!task || !task.dueDateEnd) return;
    const dateStr = task.dueDateEnd.split("T")[0];
    optimisticUpdate({ dueDateEnd: time ? `${dateStr}T${time}` : dateStr });
  }

  function handleClearEndDate() {
    optimisticUpdate({ dueDateEnd: null });
  }

  function handleQuickEndDate(type: "1h" | "sunday") {
    if (!task || !task.dueDate) return;
    if (type === "1h") {
      const hasTime = task.dueDate.includes("T");
      if (hasTime) {
        const start = parseISO(task.dueDate);
        const end = addHours(start, 1);
        optimisticUpdate({ dueDateEnd: format(end, "yyyy-MM-dd'T'HH:mm") });
      } else {
        optimisticUpdate({ dueDateEnd: task.dueDate + "T01:00" });
      }
    } else if (type === "sunday") {
      const start = parseISO(task.dueDate.split("T")[0]);
      const dayOfWeek = start.getDay();
      const daysToSunday = dayOfWeek === 0 ? 7 : 7 - dayOfWeek;
      const sunday = addDays(start, daysToSunday);
      optimisticUpdate({ dueDateEnd: format(sunday, "yyyy-MM-dd") });
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

  // AI decomposition handler

  async function handleApplyDecomposition(decomposition: {
    projectName: string;
    steps: { title: string; listName: string | null; dependsOn: number | null }[];
  }) {
    if (!task || decomposition.steps.length === 0) return;
    const { projectName, steps } = decomposition;

    // Step 1: Create project tag
    let projectTag: TaskTag | null = null;
    if (projectName) {
      const existingTag = allTagsFromProvider.find(
        (t) => t.name.toLowerCase() === projectName.toLowerCase(),
      );
      if (existingTag) {
        projectTag = existingTag;
      } else {
        const existingColors = allTagsFromProvider.map((t) => t.color);
        const color = pickNextTagColor(existingColors);
        const tagResult = await createTag({ variables: { input: { name: projectName, color } } });
        if (tagResult.data?.createTag) {
          projectTag = tagResult.data.createTag;
        }
      }
    }

    // Step 2: Rename current task to first step
    optimisticUpdate({ title: steps[0].title });
    if (steps[0].listName) {
      const targetList = allLists.find((l) => l.name === steps[0].listName);
      if (targetList) optimisticUpdate({ listId: targetList.id });
    }
    // Add project tag to original task
    if (projectTag) {
      await addTagToTask({ variables: { taskId: task.id, tagId: projectTag.id } });
      apolloClient.cache.modify({
        id: apolloClient.cache.identify({ __typename: "Task", id: task.id }),
        fields: {
          tags(existing = []) {
            const newRef = apolloClient.cache.writeFragment({
              data: projectTag,
              fragment: gql`
                fragment ProjTag on Tag {
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
    }

    // Step 3: Create remaining steps as new tasks
    // Map step index → created task ID (index 0 = original task)
    const taskIdByIndex: string[] = [task.id];

    for (let i = 1; i < steps.length; i++) {
      const step = steps[i];
      const targetList = step.listName ? allLists.find((l) => l.name === step.listName) : null;
      const newId = crypto.randomUUID();
      const result = await createTask({
        variables: {
          input: {
            id: newId,
            listId: targetList?.id ?? task.listId,
            title: step.title,
          },
        },
        update(cache, { data }) {
          if (!data?.createTask) return;
          cache.modify({
            fields: {
              visibleTasks(existing = []) {
                const newRef = cache.writeFragment({
                  data: {
                    ...data.createTask,
                    __typename: "Task",
                    reminderAt: null,
                    recurrence: null,
                    locationId: null,
                    locationRadius: null,
                    location: null,
                    deviceContext: null,
                    completedAt: null,
                    tags: [],
                    attachments: [],
                    aiAnalysis: null,
                    blockedByTaskId: null,
                    blockedByTaskIsCompleted: null,
                    dependentTaskCount: 0,
                    list: targetList
                      ? { __typename: "List", id: targetList.id, name: targetList.name }
                      : task!.list,
                  },
                  fragment: gql`
                    fragment NewDecomposedTask on Task {
                      id
                      listId
                      title
                      notes
                      isCompleted
                      dueDate
                      dueDateEnd
                      reminderAt
                      recurrence
                      sortOrder
                      createdAt
                      completedAt
                      locationId
                      locationRadius
                      location {
                        id
                        name
                        latitude
                        longitude
                        radius
                      }
                      deviceContext
                      tags {
                        id
                        name
                        color
                      }
                      steps {
                        id
                        taskId
                        title
                        isCompleted
                        sortOrder
                      }
                      attachments {
                        id
                      }
                      aiAnalysis {
                        isActionable
                        suggestion
                        suggestedTitle
                        projectName
                        decomposition {
                          title
                          listName
                          dependsOn
                        }
                        duplicateTaskId
                        callIntent {
                          name
                          reason
                        }
                        analyzedTitle
                      }
                      blockedByTaskId
                      blockedByTaskIsCompleted
                      dependentTaskCount
                      list {
                        id
                        name
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

      const createdId = result.data?.createTask?.id ?? newId;
      taskIdByIndex.push(createdId);

      // Add project tag
      if (projectTag) {
        await addTagToTask({
          variables: { taskId: createdId, tagId: projectTag.id },
          update(cache) {
            cache.modify({
              id: cache.identify({ __typename: "Task", id: createdId }),
              fields: {
                tags(existing = []) {
                  const newRef = cache.writeFragment({
                    data: projectTag,
                    fragment: gql`
                      fragment ProjTag2 on Tag {
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
      }

      // Set dependency based on AI suggestion
      if (step.dependsOn !== null && step.dependsOn >= 0 && step.dependsOn < taskIdByIndex.length) {
        const blockedById = taskIdByIndex[step.dependsOn];
        await updateTask({
          variables: { id: createdId, input: { blockedByTaskId: blockedById } },
        });
        apolloClient.cache.modify({
          id: apolloClient.cache.identify({ __typename: "Task", id: createdId }),
          fields: {
            blockedByTaskId: () => blockedById,
            blockedByTaskIsCompleted: () => false,
          },
        });
        apolloClient.cache.modify({
          id: apolloClient.cache.identify({ __typename: "Task", id: blockedById }),
          fields: {
            dependentTaskCount(existing = 0) {
              return existing + 1;
            },
          },
        });
      }
    }

    // Step 4: Mark all tasks (original + created) as actionable — prevents re-analysis
    const allTaskIds = taskIdByIndex;
    // Write to Apollo cache immediately (prevents lightbulb flicker)
    for (const id of allTaskIds) {
      const taskInCache = apolloClient.cache.identify({ __typename: "Task", id });
      if (taskInCache) {
        apolloClient.cache.modify({
          id: taskInCache,
          fields: {
            aiAnalysis() {
              return {
                __typename: "TaskAiAnalysis",
                isActionable: true,
                suggestion: null,
                suggestedTitle: null,
                projectName: null,
                decomposition: null,
                analyzedTitle: "",
              };
            },
          },
        });
      }
    }
    // Persist to DB (fire and forget)
    markTasksActionable({ variables: { taskIds: allTaskIds } });

    // Step 5: Remove ai param from URL
    const params = new URLSearchParams(searchParams.toString());
    params.delete("ai");
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  function handleDismissAi() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("ai");
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  // Recurrence handlers

  function formatRecurrence(recurrence: string | null): string | null {
    if (!recurrence) return null;
    const parsed = parseRecurrence(recurrence);
    if (!parsed) return null;

    const dayNames = tArray("recurrence.daysShort");

    switch (parsed.type) {
      case "DAILY":
        return parsed.interval === 1
          ? t("recurrence.everyDay")
          : t("recurrence.everyNDays", { n: parsed.interval });

      case "WEEKLY": {
        const daysLabel =
          parsed.days.length === 7
            ? t("recurrence.everyDay")
            : parsed.days.map((d) => dayNames[d]).join(", ");
        if (parsed.interval === 1) return daysLabel;
        return `${t("recurrence.everyNWeeks", { n: parsed.interval })}: ${daysLabel}`;
      }

      case "MONTHLY":
        return parsed.interval === 1
          ? t("recurrence.everyMonth")
          : t("recurrence.everyNMonths", { n: parsed.interval });

      case "MONTHLY_LAST":
        return parsed.interval === 1
          ? t("recurrence.everyLastDay")
          : `${t("recurrence.everyNMonths", { n: parsed.interval })}, ${t("recurrence.everyLastDay").toLowerCase()}`;

      case "YEARLY":
        return parsed.interval === 1
          ? t("recurrence.everyYear")
          : t("recurrence.everyNYears", { n: parsed.interval });
    }
  }

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
            formatRecurrence={formatRecurrence}
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
