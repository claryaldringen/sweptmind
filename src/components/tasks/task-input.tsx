"use client";

import { useState } from "react";
import { gql } from "@apollo/client";
import { useMutation } from "@apollo/client/react";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useTranslations } from "@/lib/i18n";

const CREATE_TASK = gql`
  mutation CreateTask($input: CreateTaskInput!) {
    createTask(input: $input) {
      id
      listId
      title
      notes
      isCompleted
      dueDate
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

interface Step {
  id: string;
  taskId: string;
  title: string;
  isCompleted: boolean;
  sortOrder: number;
}

interface CreatedTask {
  id: string;
  listId: string;
  title: string;
  notes: string | null;
  isCompleted: boolean;
  dueDate: string | null;
  sortOrder: number;
  createdAt: string;
  steps: Step[];
}

interface CreateTaskData {
  createTask: CreatedTask;
}

interface TaskInputProps {
  listId: string;
  refetchQueries?: string[];
  placeholder?: string;
}

export function TaskInput({ listId, refetchQueries = [], placeholder }: TaskInputProps) {
  const { t } = useTranslations();
  const [title, setTitle] = useState("");
  const [createTask] = useMutation<CreateTaskData>(CREATE_TASK, {
    refetchQueries: refetchQueries.map((q) => ({ query: gql`query { ${q} { id } }` })),
    update(cache, { data }) {
      if (!data?.createTask) return;
      cache.modify({
        fields: {
          tasksByList(existing = [], { storeFieldName }) {
            if (!storeFieldName.includes(listId)) return existing;
            const newRef = cache.writeFragment({
              data: data.createTask,
              fragment: gql`
                fragment NewTask on Task {
                  id
                  listId
                  title
                  notes
                  isCompleted
                  dueDate
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
              `,
            });
            return [newRef, ...existing];
          },
        },
      });
    },
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    await createTask({
      variables: {
        input: {
          listId,
          title: title.trim(),
        },
      },
    });

    setTitle("");
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
