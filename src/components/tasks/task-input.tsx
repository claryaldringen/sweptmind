"use client";

import { useState } from "react";
import { gql } from "@apollo/client";
import { useMutation, useApolloClient } from "@apollo/client/react";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useTranslations } from "@/lib/i18n";
import { useNewTaskPosition } from "@/hooks/use-new-task-position";
import { useAppData } from "@/components/providers/app-data-provider";

const CREATE_TASK = gql`
  mutation CreateTask($input: CreateTaskInput!) {
    createTask(input: $input) {
      id
      listId
      locationId
      title
      notes
      isCompleted
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
      blockedByTaskId
      blockedByTask {
        id
        title
      }
      blockedByTaskIsCompleted
      dependentTaskCount
    }
  }
`;

const TASK_FRAGMENT = gql`
  fragment TaskFields on Task {
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
    blockedByTaskId
    blockedByTask {
      id
      title
    }
    blockedByTaskIsCompleted
    dependentTaskCount
  }
`;

interface TaskInputProps {
  listId: string;
  placeholder?: string;
}

export function TaskInput({ listId, placeholder }: TaskInputProps) {
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
      fragment: TASK_FRAGMENT,
    });

    // Add to allTasks cache (used by AppDataProvider)
    client.cache.modify({
      fields: {
        allTasks(existing = []) {
          const newRef = { __ref: `Task:${id}` };
          return position === "top" ? [newRef, ...existing] : [...existing, newRef];
        },
      },
    });

    // Fire mutation — same ID means Apollo auto-merges server response
    createTask({
      variables: { input: { id, listId, title: trimmed } },
      onError() {
        client.cache.evict({ id: client.cache.identify({ __typename: "Task", id }) });
        client.cache.modify({
          fields: {
            allTasks(existing = [], { readField }) {
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
