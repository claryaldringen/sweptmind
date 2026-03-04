"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { gql } from "@apollo/client";
import { useQuery, useMutation } from "@apollo/client/react";
import { useState } from "react";
import { X, Bell, Calendar, Trash2, Plus, Tag, MapPin, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ResponsivePicker } from "@/components/ui/responsive-picker";
import { DatePickerContent } from "@/components/tasks/date-picker-content";
import { cn } from "@/lib/utils";
import { getTagColorClasses } from "@/lib/tag-colors";
import { useGeocode } from "@/hooks/use-geocode";
import { useNearby } from "@/components/providers/nearby-provider";
import { format, parseISO } from "date-fns";
import { cs } from "date-fns/locale/cs";
import { enUS } from "date-fns/locale/en-US";
import { useTranslations } from "@/lib/i18n";

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
    listId: string;
    locationId: string | null;
    location: TaskLocation | null;
  };
}

interface ToggleCompletedData {
  toggleTaskCompleted: { id: string; isCompleted: boolean; completedAt: string | null };
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

export function TaskDetailPanel() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t, locale: appLocale } = useTranslations();
  const dateFnsLocale = appLocale === "cs" ? cs : enUS;
  const taskId = searchParams.get("task");

  const { data, loading } = useQuery<GetTaskData>(GET_TASK, {
    variables: { id: taskId! },
    skip: !taskId,
  });

  const [updateTask] = useMutation<UpdateTaskData>(UPDATE_TASK);
  const [toggleCompleted] = useMutation<ToggleCompletedData>(TOGGLE_COMPLETED);

  const [deleteTask] = useMutation<DeleteTaskData>(DELETE_TASK, {
    update(cache) {
      cache.evict({
        id: cache.identify({ __typename: "Task", id: taskId }),
      });
      cache.gc();
    },
  });
  const [createStep] = useMutation<CreateStepData>(CREATE_STEP, {
    refetchQueries: [{ query: GET_TASK, variables: { id: taskId } }],
  });
  const [toggleStep] = useMutation<ToggleStepData>(TOGGLE_STEP);
  const [deleteStep] = useMutation<DeleteStepData>(DELETE_STEP, {
    refetchQueries: [{ query: GET_TASK, variables: { id: taskId } }],
  });
  const { data: tagsData } = useQuery<{ tags: TaskTag[] }>(GET_TAGS);
  const { data: locationsData } = useQuery<{ locations: TaskLocation[] }>(GET_LOCATIONS);
  const [createTag] = useMutation<{ createTag: TaskTag }>(CREATE_TAG, {
    refetchQueries: [{ query: GET_TAGS }],
  });
  const [addTagToTask] = useMutation<{ addTagToTask: boolean }>(ADD_TAG_TO_TASK, {
    refetchQueries: [{ query: GET_TASK, variables: { id: taskId } }],
  });
  const [removeTagFromTask] = useMutation<{ removeTagFromTask: boolean }>(REMOVE_TAG_FROM_TASK, {
    refetchQueries: [{ query: GET_TASK, variables: { id: taskId } }],
  });
  const [updateStepTitle] = useMutation(UPDATE_STEP);
  const [createLocation] = useMutation<{ createLocation: TaskLocation }>(CREATE_LOCATION, {
    refetchQueries: [{ query: GET_LOCATIONS }],
  });
  const { isNearby: checkNearby, userLatitude, userLongitude } = useNearby();
  const geocode = useGeocode({ userLatitude, userLongitude, locale: appLocale });

  const [newStepTitle, setNewStepTitle] = useState("");
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [dueDateOpen, setDueDateOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [locationPopoverOpen, setLocationPopoverOpen] = useState(false);
  const [locationSearch, setLocationSearch] = useState("");
  const [recurrenceOpen, setRecurrenceOpen] = useState(false);

  if (!taskId) return null;

  const task = data?.task;

  function closePanel() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("task");
    router.push(`?${params.toString()}`, { scroll: false });
  }

  function handleTitleBlur(e: React.FocusEvent<HTMLInputElement>) {
    const newTitle = e.target.value.trim();
    if (task && newTitle && newTitle !== task.title) {
      updateTask({
        variables: { id: task.id, input: { title: newTitle } },
      });
    } else if (task) {
      e.target.value = task.title;
    }
  }

  function handleNotesBlur(e: React.FocusEvent<HTMLTextAreaElement>) {
    if (task && e.target.value !== (task.notes ?? "")) {
      updateTask({
        variables: {
          id: task.id,
          input: { notes: e.target.value || null },
        },
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

  async function handleAddStep(e: React.FormEvent) {
    e.preventDefault();
    if (!newStepTitle.trim() || !task) return;
    await createStep({
      variables: { input: { taskId: task.id, title: newStepTitle.trim() } },
    });
    setNewStepTitle("");
  }

  function handleDelete() {
    deleteTask({ variables: { id: taskId } });
    closePanel();
  }

  async function handleAddTag(tagId: string) {
    if (!task) return;
    await addTagToTask({ variables: { taskId: task.id, tagId } });
    setTagPopoverOpen(false);
  }

  async function handleRemoveTag(tagId: string) {
    if (!task) return;
    await removeTagFromTask({ variables: { taskId: task.id, tagId } });
  }

  async function handleCreateAndAddTag() {
    if (!newTagName.trim() || !task) return;
    const result = await createTag({
      variables: { input: { name: newTagName.trim() } },
    });
    if (result.data?.createTag) {
      await addTagToTask({ variables: { taskId: task.id, tagId: result.data.createTag.id } });
    }
    setNewTagName("");
    setTagPopoverOpen(false);
  }

  async function handleSelectLocation(locationId: string) {
    if (!task) return;
    await updateTask({
      variables: { id: task.id, input: { locationId } },
      refetchQueries: [{ query: GET_TASK, variables: { id: task.id } }],
    });
    setLocationPopoverOpen(false);
    setLocationSearch("");
    geocode.clear();
  }

  async function handleSelectGeocodingResult(result: { display_name: string; lat: string; lon: string }) {
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
        variables: { id: task.id, input: { locationId: locationResult.data.createLocation.id } },
        refetchQueries: [{ query: GET_TASK, variables: { id: task.id } }],
      });
    }
    setLocationPopoverOpen(false);
    setLocationSearch("");
    geocode.clear();
  }

  async function handleRemoveLocation() {
    if (!task) return;
    await updateTask({
      variables: { id: task.id, input: { locationId: null } },
      refetchQueries: [{ query: GET_TASK, variables: { id: task.id } }],
    });
  }

  function formatRecurrence(recurrence: string | null): string | null {
    if (!recurrence) return null;
    if (recurrence === "DAILY") return t("recurrence.everyDay");
    if (recurrence === "MONTHLY") return t("recurrence.everyMonth");
    if (recurrence === "YEARLY") return t("recurrence.everyYear");
    if (recurrence.startsWith("WEEKLY:")) {
      const days = recurrence.slice(7).split(",").map(Number);
      const dayNames = t("recurrence.daysShort") as unknown as string[];
      if (days.length === 7) return t("recurrence.everyDay");
      return days.map((d) => dayNames[d]).join(", ");
    }
    return null;
  }

  function handleSetRecurrence(value: string | null) {
    if (!task) return;
    updateTask({ variables: { id: task.id, input: { recurrence: value } } });
    if (value === null) setRecurrenceOpen(false);
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

  if (loading) {
    return (
      <div className="bg-background w-96 border-l p-6">
        <div className="animate-pulse space-y-4">
          <div className="bg-muted h-6 w-3/4 rounded" />
          <div className="bg-muted h-4 w-1/2 rounded" />
          <div className="bg-muted h-20 rounded" />
        </div>
      </div>
    );
  }

  if (!task) return null;

  return (
    <div className="bg-background flex w-96 flex-col border-l">
      <div className="flex items-center justify-between p-4">
        <Button variant="ghost" size="icon" onClick={closePanel}>
          <X className="h-4 w-4" />
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
              "h-auto border-0 bg-transparent p-0 text-lg font-medium leading-tight shadow-none outline-none focus-visible:ring-0 md:text-lg",
              task.isCompleted && "text-muted-foreground line-through",
            )}
          />
        </div>

        {/* Steps */}
        <div className="space-y-1">
          {task.steps?.map((step: { id: string; title: string; isCompleted: boolean }) => (
            <div key={step.id} className="group flex items-center gap-2">
              <Checkbox
                checked={step.isCompleted}
                onCheckedChange={() => toggleStep({ variables: { id: step.id } })}
                className="h-4 w-4 rounded-full"
              />
              <Input
                defaultValue={step.title}
                onBlur={(e) => {
                  const newTitle = e.target.value.trim();
                  if (newTitle && newTitle !== step.title) {
                    updateStepTitle({ variables: { id: step.id, title: newTitle } });
                  } else {
                    e.target.value = step.title;
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  if (e.key === "Escape") {
                    e.currentTarget.value = step.title;
                    e.currentTarget.blur();
                  }
                }}
                className={cn(
                  "h-auto flex-1 border-0 bg-transparent p-0 text-sm shadow-none outline-none focus-visible:ring-0 md:text-sm",
                  step.isCompleted && "text-muted-foreground line-through",
                )}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100"
                onClick={() => deleteStep({ variables: { id: step.id } })}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
          <form onSubmit={handleAddStep} className="flex items-center gap-2">
            <Plus className="text-muted-foreground h-4 w-4" />
            <Input
              value={newStepTitle}
              onChange={(e) => setNewStepTitle(e.target.value)}
              placeholder={t("tasks.addStep")}
              className="h-8 border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
            />
          </form>
        </div>

        <Separator />

        {/* Actions */}
        <div className="space-y-1">
          <ResponsivePicker
            open={dueDateOpen}
            onOpenChange={setDueDateOpen}
            title={t("datePicker.dueDate")}
            trigger={
              <Button
                variant="ghost"
                className={cn("w-full justify-start gap-2", task.dueDate && "text-blue-500")}
              >
                <Calendar className="h-4 w-4" />
                {task.dueDate
                  ? t("tasks.dueDate", { date: format(parseISO(task.dueDate), task.dueDate.includes("T") ? "MMM d, yyyy h:mm a" : "MMM d, yyyy", { locale: dateFnsLocale }) })
                  : t("tasks.addDueDate")}
              </Button>
            }
          >
            <DatePickerContent
              value={task.dueDate ? parseISO(task.dueDate) : undefined}
              hasTime={task.dueDate?.includes("T") ?? false}
              timeValue={task.dueDate?.includes("T") ? task.dueDate.split("T")[1] : ""}
              onDateSelect={handleDateSelect}
              onTimeChange={handleTimeChange}
              onClear={() => updateTask({ variables: { id: task.id, input: { dueDate: null } } })}
              onClose={() => setDueDateOpen(false)}
              t={t}
              dateFnsLocale={dateFnsLocale}
              showTimeToggle
            />
          </ResponsivePicker>

          {/* Reminder */}
          <ResponsivePicker
            open={reminderOpen}
            onOpenChange={setReminderOpen}
            title={t("datePicker.reminder")}
            trigger={
              <Button
                variant="ghost"
                className={cn("w-full justify-start gap-2", task.reminderAt && "text-blue-500")}
              >
                <Bell className="h-4 w-4" />
                {task.reminderAt
                  ? t("tasks.reminder", { date: format(parseISO(task.reminderAt), "MMM d, yyyy", { locale: dateFnsLocale }) })
                  : t("tasks.addReminder")}
              </Button>
            }
          >
            <DatePickerContent
              value={task.reminderAt ? parseISO(task.reminderAt) : undefined}
              hasTime={false}
              timeValue=""
              onDateSelect={(date) => {
                if (!date) {
                  updateTask({ variables: { id: task.id, input: { reminderAt: null } } });
                  return;
                }
                const reminderAt = format(date, "yyyy-MM-dd");
                updateTask({ variables: { id: task.id, input: { reminderAt } } });
              }}
              onClear={() => updateTask({ variables: { id: task.id, input: { reminderAt: null } } })}
              onClose={() => setReminderOpen(false)}
              t={t}
              dateFnsLocale={dateFnsLocale}
              showTimeToggle={false}
            />
          </ResponsivePicker>

          {/* Recurrence */}
          <Popover open={recurrenceOpen} onOpenChange={setRecurrenceOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                className={cn("w-full justify-start gap-2", task.recurrence && "text-blue-500")}
              >
                <Repeat className="h-4 w-4" />
                {task.recurrence
                  ? formatRecurrence(task.recurrence)
                  : t("recurrence.addRecurrence")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 space-y-2 p-3" align="start">
              <div className="space-y-1">
                {(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"] as const).map((type) => (
                  <Button
                    key={type}
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "w-full justify-start",
                      task.recurrence === type && "bg-accent",
                      type === "WEEKLY" && task.recurrence?.startsWith("WEEKLY:") && "bg-accent",
                    )}
                    onClick={() => {
                      if (type === "WEEKLY") {
                        const today = new Date().getDay();
                        handleSetRecurrence(`WEEKLY:${today}`);
                      } else {
                        handleSetRecurrence(type);
                      }
                    }}
                  >
                    {t(`recurrence.${type.toLowerCase() as "daily" | "weekly" | "monthly" | "yearly"}`)}
                  </Button>
                ))}
              </div>

              {task.recurrence?.startsWith("WEEKLY:") && (
                <>
                  <Separator />
                  <div className="flex gap-1">
                    {(t("recurrence.daysShort") as unknown as string[]).map(
                      (dayName, index) => {
                        const isActive = task.recurrence
                          ?.slice(7)
                          .split(",")
                          .map(Number)
                          .includes(index);
                        return (
                          <Button
                            key={index}
                            variant={isActive ? "default" : "outline"}
                            size="sm"
                            className="h-8 w-8 p-0 text-xs"
                            onClick={() => handleToggleWeeklyDay(index)}
                          >
                            {dayName}
                          </Button>
                        );
                      },
                    )}
                  </div>
                </>
              )}

              {task.recurrence && (
                <>
                  <Separator />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive w-full justify-start"
                    onClick={() => handleSetRecurrence(null)}
                  >
                    {t("recurrence.removeRecurrence")}
                  </Button>
                </>
              )}
            </PopoverContent>
          </Popover>

          {/* Tags */}
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1">
              {task.tags?.map((tag) => {
                const colors = getTagColorClasses(tag.color);
                return (
                  <Badge
                    key={tag.id}
                    variant="secondary"
                    className={cn("gap-1 pr-1", colors.bg, colors.text)}
                  >
                    {tag.name}
                    <button
                      onClick={() => handleRemoveTag(tag.id)}
                      className="rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                );
              })}
            </div>
            <Popover open={tagPopoverOpen} onOpenChange={setTagPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" className="w-full justify-start gap-2">
                  <Tag className="h-4 w-4" />
                  {t("tasks.addTag")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-0" align="start">
                <Command>
                  <CommandInput
                    placeholder={t("tasks.searchOrCreateTag")}
                    value={newTagName}
                    onValueChange={setNewTagName}
                  />
                  <CommandList>
                    <CommandEmpty>
                      {newTagName.trim() && (
                        <button
                          onClick={handleCreateAndAddTag}
                          className="text-primary cursor-pointer text-sm"
                        >
                          {t("tasks.createTag", { name: newTagName.trim() })}
                        </button>
                      )}
                    </CommandEmpty>
                    <CommandGroup>
                      {(tagsData?.tags ?? [])
                        .filter((tg) => !task.tags?.some((tt) => tt.id === tg.id))
                        .map((tag) => {
                          const colors = getTagColorClasses(tag.color);
                          return (
                            <CommandItem key={tag.id} onSelect={() => handleAddTag(tag.id)}>
                              <span className={cn("h-3 w-3 rounded-full", colors.bg)} />
                              {tag.name}
                            </CommandItem>
                          );
                        })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Location */}
          <div className="space-y-2">
            {task.location && (
              <div className="flex items-center gap-1">
                <Badge
                  variant="secondary"
                  className={cn(
                    "gap-1 pr-1",
                    checkNearby(task.location.latitude, task.location.longitude)
                      ? "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400"
                      : "",
                  )}
                >
                  <MapPin className={cn(
                    "h-3 w-3",
                    checkNearby(task.location.latitude, task.location.longitude) && "animate-pulse",
                  )} />
                  {task.location.name}
                  <button
                    onClick={handleRemoveLocation}
                    className="rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              </div>
            )}
            <Popover
              open={locationPopoverOpen}
              onOpenChange={(open) => {
                setLocationPopoverOpen(open);
                if (!open) {
                  setLocationSearch("");
                  geocode.clear();
                }
              }}
            >
              <PopoverTrigger asChild>
                <Button variant="ghost" className="w-full justify-start gap-2">
                  <MapPin className="h-4 w-4" />
                  {t("tasks.addLocation")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder={t("tasks.searchLocation")}
                    value={locationSearch}
                    onValueChange={(val) => {
                      setLocationSearch(val);
                      geocode.search(val);
                    }}
                  />
                  <CommandList>
                    <CommandEmpty />
                    {(locationsData?.locations ?? []).length > 0 && (
                      <CommandGroup heading={t("tasks.savedLocations")}>
                        {(locationsData?.locations ?? []).map((loc) => (
                          <CommandItem key={loc.id} onSelect={() => handleSelectLocation(loc.id)}>
                            <MapPin className="mr-2 h-3 w-3" />
                            {loc.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                    {geocode.results.length > 0 && (
                      <CommandGroup heading={t("tasks.searchResults")}>
                        {geocode.results.map((result, i) => (
                          <CommandItem
                            key={i}
                            onSelect={() => handleSelectGeocodingResult(result)}
                          >
                            <MapPin className="mr-2 h-3 w-3" />
                            <span className="truncate">{result.display_name}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
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
      <div className="flex items-center justify-between border-t px-4 py-3">
        <span className="text-muted-foreground text-xs">
          {t("tasks.created", { date: format(parseISO(task.createdAt), "EEE, MMM d", { locale: dateFnsLocale }) })}
        </span>
        <Button variant="ghost" size="icon" onClick={handleDelete}>
          <Trash2 className="text-muted-foreground h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
