"use client";

import { useState } from "react";
import { gql } from "@apollo/client";
import { useMutation, useApolloClient } from "@apollo/client/react";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useTranslations } from "@/lib/i18n";
import { useNewTaskPosition } from "@/hooks/use-new-task-position";
import { useAppData, APP_TASK_FIELDS } from "@/components/providers/app-data-provider";

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

    // Write task to cache immediately (optimistic, same ID as server will use)
    client.cache.writeFragment({
      data: {
        __typename: "Task",
        id,
        listId,
        locationId: null,
        locationRadius: null,
        title: trimmed,
        notes: null,
        isCompleted: false,
        completedAt: null,
        dueDate: null,
        reminderAt: null,
        recurrence: null,
        deviceContext: null,
        sortOrder,
        createdAt: new Date().toISOString(),
        steps: [],
        tags: [],
        location: null,
        list: { __typename: "List", id: listId, name: "" },
        blockedByTaskId: null,
        blockedByTask: null,
        blockedByTaskIsCompleted: null,
        dependentTaskCount: 0,
      },
      fragment: APP_TASK_FIELDS,
      fragmentName: "AppTaskFields",
    });

    // Add to visibleTasks cache (used by AppDataProvider)
    client.cache.modify({
      fields: {
        visibleTasks(existing = []) {
          const newRef = { __ref: `Task:${id}` };
          return position === "top" ? [newRef, ...existing] : [...existing, newRef];
        },
      },
    });

    onTaskCreated?.();

    // Fire mutation — same ID means Apollo auto-merges server response
    createTask({
      variables: { input: { id, listId, title: trimmed } },
      onError() {
        client.cache.evict({ id: client.cache.identify({ __typename: "Task", id }) });
        client.cache.modify({
          fields: {
            visibleTasks(existing = [], { readField }) {
              return existing.filter((ref: { __ref: string }) => readField("id", ref) !== id);
            },
          },
        });
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
