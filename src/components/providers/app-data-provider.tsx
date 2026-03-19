"use client";

import {
  createContext,
  useContext,
  useMemo,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { gql } from "@apollo/client";
import { useQuery, useApolloClient } from "@apollo/client/react";
import { detectTimeConflicts } from "@/lib/time-conflicts";
import type { TaskStep, TaskTag, TaskLocationInfo as TaskLocation } from "@/components/tasks/types";

// Re-export shared sub-types so existing consumers don't break
export type { TaskStep, TaskTag };
export type { TaskLocationInfo as TaskLocation } from "@/components/tasks/types";

// ---------------------------------------------------------------------------
// Shared task fields fragment
// ---------------------------------------------------------------------------

export const APP_TASK_FIELDS = gql`
  fragment AppTaskFields on Task {
    id
    listId
    locationId
    locationRadius
    title
    notes
    isCompleted
    completedAt
    dueDate
    dueDateEnd
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
    dependentTaskCount
    attachments {
      id
      taskId
      fileName
      fileSize
      mimeType
      createdAt
    }
    aiAnalysis {
      id
      taskId
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
    isGoogleCalendarEvent
  }
`;

// ---------------------------------------------------------------------------
// Phase 1: App metadata + active tasks (all non-completed)
// ---------------------------------------------------------------------------

export const GET_APP_DATA = gql`
  ${APP_TASK_FIELDS}
  query GetAppData {
    lists {
      id
      name
      icon
      themeColor
      isDefault
      sortOrder
      groupId
      locationId
      locationRadius
      deviceContext
      taskCount
      visibleTaskCount
      location {
        id
        name
        latitude
        longitude
        radius
      }
    }
    activeTasks {
      ...AppTaskFields
    }
    tags {
      id
      name
      color
      taskCount
      deviceContext
      locationId
      locationRadius
      location {
        id
        name
        latitude
        longitude
        radius
      }
    }
    locations {
      id
      name
      latitude
      longitude
      radius
      address
    }
  }
`;

// ---------------------------------------------------------------------------
// Phase 2: Completed tasks (loaded in background, paginated)
// ---------------------------------------------------------------------------

const GET_COMPLETED_TASKS = gql`
  ${APP_TASK_FIELDS}
  query GetCompletedTasks($limit: Int!, $offset: Int) {
    completedTasks(limit: $limit, offset: $offset) {
      tasks {
        ...AppTaskFields
      }
      hasMore
    }
  }
`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ListLocationInfo {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
}

export interface ListItem {
  id: string;
  name: string;
  icon: string | null;
  themeColor: string | null;
  isDefault: boolean;
  sortOrder: number;
  groupId: string | null;
  locationId: string | null;
  locationRadius: number | null;
  location: ListLocationInfo | null;
  deviceContext: string | null;
  taskCount: number;
  visibleTaskCount: number;
}

export interface TaskAttachment {
  id: string;
  taskId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
}

export interface AppTask {
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
  dependentTaskCount: number;
  attachments: TaskAttachment[];
  aiAnalysis: {
    id: string;
    taskId: string;
    isActionable: boolean;
    suggestion: string | null;
    suggestedTitle: string | null;
    projectName: string | null;
    decomposition: { title: string; listName: string | null; dependsOn: number | null }[] | null;
    duplicateTaskId: string | null;
    callIntent: { name: string; reason: string | null } | null;
    analyzedTitle: string;
  } | null;
}

export interface TagItem {
  id: string;
  name: string;
  color: string;
  taskCount: number;
  deviceContext: string | null;
  locationId: string | null;
  locationRadius: number | null;
  location: ListLocationInfo | null;
}

export interface LocationItem {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
  address: string | null;
}

interface GetAppDataResult {
  lists: ListItem[];
  activeTasks: AppTask[];
  tags: TagItem[];
  locations: LocationItem[];
}

interface GetCompletedTasksResult {
  completedTasks: {
    tasks: AppTask[];
    hasMore: boolean;
  };
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface AppDataContextValue {
  lists: ListItem[];
  allTasks: AppTask[];
  tags: TagItem[];
  locations: LocationItem[];
  loading: boolean;
  /** True once initial completed tasks have been loaded */
  completedTasksLoaded: boolean;
  hasMoreCompleted: boolean;
  fetchMoreCompleted: () => void;
  refetch: () => void;
  /** Set of task IDs that have time conflicts */
  conflictingTaskIds: Set<string>;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AppDataProvider({ children }: { children: ReactNode }) {
  // Phase 1: metadata + active tasks (all non-completed)
  const {
    data: appData,
    loading: appLoading,
    refetch: refetchAppData,
  } = useQuery<GetAppDataResult>(GET_APP_DATA);

  // Phase 2: completed tasks (loaded after phase 1, paginated)
  const apolloClient = useApolloClient();
  const [completedTasks, setCompletedTasks] = useState<AppTask[]>([]);
  const [hasMoreCompleted, setHasMoreCompleted] = useState(true);
  const [completedLoaded, setCompletedLoaded] = useState(false);
  const completedLoadingRef = useRef(false);

  const loadCompletedTasks = useCallback(
    async (offset: number) => {
      if (completedLoadingRef.current) return;
      completedLoadingRef.current = true;
      try {
        const result = await apolloClient.query<GetCompletedTasksResult>({
          query: GET_COMPLETED_TASKS,
          variables: { limit: 10, offset },
          fetchPolicy: "network-only",
        });
        const { data } = result;
        if (!data) return;
        setCompletedTasks((prev) => {
          const existingIds = new Set(prev.map((t) => t.id));
          const newTasks = data.completedTasks.tasks.filter((t) => !existingIds.has(t.id));
          return [...prev, ...newTasks];
        });
        setHasMoreCompleted(data.completedTasks.hasMore);
        setCompletedLoaded(true);
      } finally {
        completedLoadingRef.current = false;
      }
    },
    [apolloClient],
  );

  // Sequential loading: phase 1 → phase 2
  useEffect(() => {
    if (appData && !completedLoaded) {
      loadCompletedTasks(0);
    }
  }, [appData, completedLoaded, loadCompletedTasks]);

  // Fetch more completed tasks (for infinite scroll)
  const fetchMoreCompleted = useCallback(() => {
    if (!hasMoreCompleted) return;
    loadCompletedTasks(completedTasks.length);
  }, [hasMoreCompleted, completedTasks.length, loadCompletedTasks]);

  // Merge active + completed into a single array
  const allTasks = useMemo(() => {
    const active = appData?.activeTasks ?? [];
    if (completedTasks.length === 0) return active;

    const seen = new Set<string>();
    const result: AppTask[] = [];
    for (const task of active) {
      if (!seen.has(task.id)) {
        seen.add(task.id);
        result.push(task);
      }
    }
    for (const task of completedTasks) {
      if (!seen.has(task.id)) {
        seen.add(task.id);
        result.push(task);
      }
    }
    return result;
  }, [appData?.activeTasks, completedTasks]);

  const refetch = useCallback(() => {
    refetchAppData();
    setCompletedTasks([]);
    setCompletedLoaded(false);
    setHasMoreCompleted(true);
  }, [refetchAppData]);

  const conflictingTaskIds = useMemo(() => detectTimeConflicts(allTasks), [allTasks]);

  const value = useMemo(
    () => ({
      lists: appData?.lists ?? [],
      allTasks,
      tags: appData?.tags ?? [],
      locations: appData?.locations ?? [],
      loading: appLoading && !appData,
      completedTasksLoaded: completedLoaded,
      hasMoreCompleted,
      fetchMoreCompleted,
      refetch,
      conflictingTaskIds,
    }),
    [
      appData,
      allTasks,
      appLoading,
      completedLoaded,
      hasMoreCompleted,
      fetchMoreCompleted,
      refetch,
      conflictingTaskIds,
    ],
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useAppData(): AppDataContextValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used within AppDataProvider");
  return ctx;
}

/** Backward-compatible hook — returns lists with server-computed task counts. */
export function useLists() {
  const { lists, loading, refetch } = useAppData();

  const listsWithCounts = useMemo(
    () =>
      lists.map((list) => ({
        ...list,
        taskCount: list.taskCount,
        visibleTaskCount: list.visibleTaskCount,
      })),
    [lists],
  );

  return { lists: listsWithCounts, loading, refetch };
}
