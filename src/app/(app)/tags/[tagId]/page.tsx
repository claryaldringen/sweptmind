"use client";

import { useRef } from "react";
import { useParams } from "next/navigation";
import { gql } from "@apollo/client";
import { useQuery, useMutation } from "@apollo/client/react";
import { Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { getTagColorClasses } from "@/lib/tag-colors";
import { TaskList } from "@/components/tasks/task-list";
import { TaskDetailPanel } from "@/components/tasks/task-detail-panel";
import { Input } from "@/components/ui/input";
import { useTranslations } from "@/lib/i18n";

const GET_TAGS = gql`
  query GetTags {
    tags {
      id
      name
      color
    }
  }
`;

const UPDATE_TAG = gql`
  mutation UpdateTag($id: String!, $input: UpdateTagInput!) {
    updateTag(id: $id, input: $input) {
      id
      name
    }
  }
`;

const TASKS_BY_TAG = gql`
  query TasksByTag($tagId: String!) {
    tasksByTag(tagId: $tagId) {
      id
      listId
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
      list {
        id
        name
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

interface TaskTag {
  id: string;
  name: string;
  color: string;
}

interface TagTask {
  id: string;
  listId: string;
  title: string;
  notes: string | null;
  isCompleted: boolean;
  dueDate: string | null;
  reminderAt: string | null;
  sortOrder: number;
  createdAt: string;
  steps: Step[];
  tags: TaskTag[];
  list: { id: string; name: string } | null;
}

interface TasksByTagData {
  tasksByTag: TagTask[];
}

interface GetTagsData {
  tags: TaskTag[];
}

export default function TagPage() {
  const { tagId } = useParams<{ tagId: string }>();
  const { t } = useTranslations();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const { data: tagsData } = useQuery<GetTagsData>(GET_TAGS);
  const { data, loading } = useQuery<TasksByTagData>(TASKS_BY_TAG, {
    variables: { tagId },
  });
  const [updateTag] = useMutation(UPDATE_TAG, {
    refetchQueries: [{ query: GET_TAGS }],
  });

  const tag = tagsData?.tags?.find((t) => t.id === tagId);
  const tasks = data?.tasksByTag ?? [];
  const colors = tag ? getTagColorClasses(tag.color) : getTagColorClasses("blue");

  function handleRename(e: React.FocusEvent<HTMLInputElement>) {
    const newName = e.target.value.trim();
    if (newName && tag && newName !== tag.name) {
      updateTag({ variables: { id: tag.id, input: { name: newName } } });
    } else if (tag) {
      e.target.value = tag.name;
    }
  }

  return (
    <div className="flex flex-1">
      <div className="flex flex-1 flex-col">
        <div className="px-6 pt-8 pb-4">
          <div className="flex items-center gap-2">
            <Tag className={cn("h-7 w-7", colors.text)} />
            <Input
              ref={nameInputRef}
              key={tag?.id}
              defaultValue={tag?.name ?? t("pages.tag")}
              onBlur={handleRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") {
                  e.currentTarget.value = tag?.name ?? "";
                  e.currentTarget.blur();
                }
              }}
              className="h-auto rounded-none border-0 bg-transparent p-0 text-2xl font-bold leading-tight shadow-none outline-none focus-visible:ring-0 md:text-2xl"
            />
          </div>
        </div>
        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-muted-foreground animate-pulse">{t("common.loading")}</div>
          </div>
        ) : (
          <TaskList tasks={tasks} showListName />
        )}
      </div>
      <TaskDetailPanel />
    </div>
  );
}
