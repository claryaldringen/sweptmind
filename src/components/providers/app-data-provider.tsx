"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";

// ---------------------------------------------------------------------------
// Query
// ---------------------------------------------------------------------------

export const GET_APP_DATA = gql`
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
      location {
        id
        name
        latitude
        longitude
        radius
      }
    }
    allTasks {
      id
      listId
      locationId
      locationRadius
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
}

export interface TaskStep {
  id: string;
  taskId: string;
  title: string;
  isCompleted: boolean;
  sortOrder: number;
}

export interface TaskTag {
  id: string;
  name: string;
  color: string;
}

export interface TaskLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
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
  allTasks: AppTask[];
  tags: TagItem[];
  locations: LocationItem[];
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
  refetch: () => void;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AppDataProvider({ children }: { children: ReactNode }) {
  const { data, loading, refetch } = useQuery<GetAppDataResult>(GET_APP_DATA);

  const value = useMemo(
    () => ({
      lists: data?.lists ?? [],
      allTasks: data?.allTasks ?? [],
      tags: data?.tags ?? [],
      locations: data?.locations ?? [],
      loading,
      refetch,
    }),
    [data, loading, refetch],
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

/** Backward-compatible hook — returns lists with computed task counts. */
export function useLists() {
  const { lists, allTasks, loading, refetch } = useAppData();

  const listsWithCounts = useMemo(() => {
    const countMap = new Map<string, { total: number; visible: number }>();
    for (const list of lists) {
      countMap.set(list.id, { total: 0, visible: 0 });
    }
    for (const task of allTasks) {
      if (task.isCompleted) continue;
      const entry = countMap.get(task.listId);
      if (!entry) continue;
      entry.total++;
      // Visible = not future task (simplified: no future dueDate/reminder, not blocked)
      const isFuture = isFutureTaskSimple(task);
      if (!isFuture) entry.visible++;
    }
    return lists.map((list) => ({
      ...list,
      taskCount: countMap.get(list.id)?.total ?? 0,
      visibleTaskCount: countMap.get(list.id)?.visible ?? 0,
    }));
  }, [lists, allTasks]);

  return { lists: listsWithCounts, loading, refetch };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Simplified isFutureTask for client-side use (matches domain/services/task-visibility). */
function isFutureTaskSimple(task: AppTask): boolean {
  if (task.isCompleted) return false;
  if (task.blockedByTaskId && task.blockedByTaskIsCompleted === false) return true;

  const todayStr = new Date().toISOString().slice(0, 10);

  if (task.reminderAt) {
    return task.reminderAt > todayStr;
  }

  if (!task.dueDate) return false;

  if (task.dueDate.includes("T")) {
    // Has time → visible the day before
    const datePart = task.dueDate.split("T")[0];
    const [year, month, day] = datePart.split("-").map(Number);
    const date = new Date(year, month - 1, day - 1);
    const visibleDate = date.toISOString().slice(0, 10);
    return visibleDate > todayStr;
  }

  return task.dueDate > todayStr;
}
