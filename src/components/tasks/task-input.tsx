"use client";

import { useState } from "react";
import { gql, type Reference, type StoreObject } from "@apollo/client";
import { useMutation, useApolloClient } from "@apollo/client/react";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useTranslations } from "@/lib/i18n";
import { useNewTaskPosition } from "@/hooks/use-new-task-position";

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
  }
`;

interface TaskInputProps {
  listId: string;
  refetchQueries?: string[];
  placeholder?: string;
}

export function TaskInput({ listId, refetchQueries = [], placeholder }: TaskInputProps) {
  const { t } = useTranslations();
  const [title, setTitle] = useState("");
  const client = useApolloClient();
  const { position } = useNewTaskPosition();

  const [createTask] = useMutation<{ createTask: Record<string, unknown> }>(CREATE_TASK, {
    refetchQueries: refetchQueries.map((q) => ({ query: gql`query { ${q} { id } }` })),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;

    setTitle("");

    const tempId = `temp-${Date.now()}`;

    // Write temp task directly to cache (no optimistic layer = no rollback flicker)
    const tempRef = client.cache.writeFragment({
      data: {
        __typename: "Task",
        id: tempId,
        listId,
        locationId: null,
        title: trimmed,
        notes: null,
        isCompleted: false,
        dueDate: null,
        reminderAt: null,
        recurrence: null,
        sortOrder: 0,
        createdAt: new Date().toISOString(),
        steps: [],
        tags: [],
        location: null,
      },
      fragment: TASK_FRAGMENT,
    });

    client.cache.modify({
      fields: {
        tasksByList(existing = [], { storeFieldName }) {
          if (!storeFieldName.includes(listId)) return existing;
          return position === "top" ? [tempRef, ...existing] : [...existing, tempRef];
        },
      },
    });

    // Fire mutation — on success, swap temp for real; on error, remove temp
    createTask({
      variables: { input: { listId, title: trimmed } },
      update(cache, { data }) {
        if (!data?.createTask) return;
        const newRef = cache.writeFragment({
          data: data.createTask,
          fragment: TASK_FRAGMENT,
        });
        cache.modify({
          fields: {
            tasksByList(existing = [], { storeFieldName, readField }) {
              if (!storeFieldName.includes(listId)) return existing;
              return existing.map((ref: Reference | StoreObject | undefined) =>
                readField("id", ref) === tempId ? newRef : ref,
              );
            },
          },
        });
        cache.evict({ id: cache.identify({ __typename: "Task", id: tempId }) });
        cache.gc();
      },
      onError() {
        client.cache.modify({
          fields: {
            tasksByList(existing = [], { storeFieldName, readField }) {
              if (!storeFieldName.includes(listId)) return existing;
              return existing.filter(
                (ref: Reference | StoreObject | undefined) => readField("id", ref) !== tempId,
              );
            },
          },
        });
        client.cache.evict({
          id: client.cache.identify({ __typename: "Task", id: tempId }),
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
