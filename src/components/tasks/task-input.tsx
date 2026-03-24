"use client";

import { useState } from "react";
import { gql } from "@apollo/client";
import { useMutation, useApolloClient } from "@apollo/client/react";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useTranslations } from "@/lib/i18n";
import { useNewTaskPosition } from "@/hooks/use-new-task-position";
import {
  useAppData,
  APP_TASK_FIELDS,
  GET_APP_DATA,
  type GetAppDataResult,
} from "@/components/providers/app-data-provider";

const CREATE_TASK = gql`
  ${APP_TASK_FIELDS}
  mutation CreateTask($input: CreateTaskInput!) {
    createTask(input: $input) {
      ...AppTaskFields
    }
  }
`;

interface TaskInputProps {
  listId: string;
  placeholder?: string;
  onTaskCreated?: () => void;
}

export function TaskInput({ listId, placeholder, onTaskCreated }: TaskInputProps) {
  const { t } = useTranslations();
  const [title, setTitle] = useState("");
  const client = useApolloClient();
  const { position } = useNewTaskPosition();
  const { allTasks } = useAppData();

  const [createTask] = useMutation<{ createTask: Record<string, unknown> }>(CREATE_TASK);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;

    setTitle("");

    const id = crypto.randomUUID();

    // Match server logic: sortOrder = minSort - 1 (puts task at top)
    const listTasks = allTasks.filter((t) => t.listId === listId);
    const minSort = listTasks.length > 0 ? Math.min(...listTasks.map((t) => t.sortOrder)) : 1;
    const sortOrder = minSort - 1;

    const newTask = {
      __typename: "Task" as const,
      id,
      listId,
      locationId: null,
      locationRadius: null,
      title: trimmed,
      notes: null,
      isCompleted: false,
      completedAt: null,
      dueDate: null,
      dueDateEnd: null,
      reminderAt: null,
      recurrence: null,
      deviceContext: null,
      sortOrder,
      createdAt: new Date().toISOString(),
      steps: [],
      tags: [],
      location: null,
      list: { __typename: "List" as const, id: listId, name: "" },
      blockedByTaskId: null,
      blockedByTask: null,
      blockedByTaskIsCompleted: null,
      dependentTaskCount: 0,
      attachments: [],
      aiAnalysis: null,
      isGoogleCalendarEvent: false,
      isSharedTo: false,
      isSharedFrom: false,
      shareCompletionMode: null,
      shareCompletionAction: null,
      shareCompletionListId: null,
    };

    // Write optimistic data using writeQuery — this properly notifies useQuery
    // watchers (cache.modify on root fields does not with cache-first policy).
    const existing = client.cache.readQuery<GetAppDataResult>({ query: GET_APP_DATA });
    if (existing) {
      client.cache.writeQuery({
        query: GET_APP_DATA,
        data: {
          ...existing,
          activeTasks:
            position === "top"
              ? [newTask, ...existing.activeTasks]
              : [...existing.activeTasks, newTask],
          lists: existing.lists.map((list) =>
            list.id === listId
              ? {
                  ...list,
                  taskCount: list.taskCount + 1,
                  visibleTaskCount: list.visibleTaskCount + 1,
                }
              : list,
          ),
        },
      });
    }

    onTaskCreated?.();

    // Fire mutation — same ID means Apollo auto-merges server response
    createTask({
      variables: { input: { id, listId, title: trimmed } },
      update(cache, { data }) {
        if (!data?.createTask) return;
        // Re-ensure the task is in activeTasks after mutation completes.
        const current = cache.readQuery<GetAppDataResult>({ query: GET_APP_DATA });
        if (!current) return;
        const alreadyExists = current.activeTasks.some((t) => t.id === id);
        if (alreadyExists) return;
        cache.writeQuery({
          query: GET_APP_DATA,
          data: {
            ...current,
            activeTasks:
              position === "top"
                ? [data.createTask, ...current.activeTasks]
                : [...current.activeTasks, data.createTask],
          },
        });
      },
      onError() {
        const current = client.cache.readQuery<GetAppDataResult>({ query: GET_APP_DATA });
        if (current) {
          client.cache.writeQuery({
            query: GET_APP_DATA,
            data: {
              ...current,
              activeTasks: current.activeTasks.filter((t) => t.id !== id),
              lists: current.lists.map((list) =>
                list.id === listId
                  ? {
                      ...list,
                      taskCount: Math.max(0, list.taskCount - 1),
                      visibleTaskCount: Math.max(0, list.visibleTaskCount - 1),
                    }
                  : list,
              ),
            },
          });
        }
        client.cache.evict({ id: client.cache.identify({ __typename: "Task", id }) });
        client.cache.gc();
      },
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t px-4 py-3">
      <Plus className="text-primary h-5 w-5" />
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={placeholder ?? t("tasks.addTask")}
        className="border-0 bg-transparent shadow-none focus-visible:ring-0"
      />
    </form>
  );
}
