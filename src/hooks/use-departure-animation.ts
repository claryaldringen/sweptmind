import { useState, useEffect, useLayoutEffect, useRef, useMemo } from "react";
import { isFutureTask } from "@/domain/services/task-visibility";

interface VisibilityTask {
  id: string;
  isCompleted: boolean;
  dueDate: string | null;
  reminderAt: string | null;
  recurrence?: string | null;
}

interface DepartureAnimationResult<T extends VisibilityTask> {
  activeTasks: T[];
  futureTasks: T[];
  completedTasks: T[];
  departingIds: Set<string>;
  /** Active tasks plus any currently-departing tasks in original order. */
  activeWithDeparting: T[];
  listRef: React.RefObject<HTMLDivElement | null>;
  futureSectionRef: React.RefObject<HTMLDivElement | null>;
}

export function useDepartureAnimation<T extends VisibilityTask>(tasks: T[]): DepartureAnimationResult<T> {
  const { activeTasks, futureTasks, completedTasks } = useMemo(() => {
    const active: T[] = [];
    const future: T[] = [];
    const completed: T[] = [];
    for (const t of tasks) {
      if (t.isCompleted) completed.push(t);
      else if (isFutureTask(t)) future.push(t);
      else active.push(t);
    }
    future.sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
    return { activeTasks: active, futureTasks: future, completedTasks: completed };
  }, [tasks]);

  const taskMap = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  // Detect tasks departing to "Future" during render (no flash)
  const [departingIds, setDepartingIds] = useState<Set<string>>(new Set());
  const prevActiveIdsRef = useRef(new Set<string>());

  const currentActiveSet = useMemo(() => new Set(activeTasks.map((t) => t.id)), [activeTasks]);
  const newDepartures: string[] = [];
  for (const id of prevActiveIdsRef.current) {
    if (!currentActiveSet.has(id) && !departingIds.has(id)) {
      const task = taskMap.get(id);
      if (task && isFutureTask(task)) newDepartures.push(id);
    }
  }
  prevActiveIdsRef.current = currentActiveSet;

  if (newDepartures.length > 0) {
    setDepartingIds((prev) => {
      const next = new Set(prev);
      newDepartures.forEach((id) => next.add(id));
      return next;
    });
  }

  useEffect(() => {
    if (departingIds.size > 0) {
      const timer = setTimeout(() => setDepartingIds(new Set()), 750);
      return () => clearTimeout(timer);
    }
  }, [departingIds]);

  const activeWithDeparting = useMemo(() => {
    if (departingIds.size === 0) return activeTasks;
    return tasks.filter((t) => (!t.isCompleted && !isFutureTask(t)) || departingIds.has(t.id));
  }, [tasks, activeTasks, departingIds]);

  const listRef = useRef<HTMLDivElement>(null);
  const futureSectionRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (departingIds.size === 0 || !futureSectionRef.current || !listRef.current) return;
    const targetY = futureSectionRef.current.getBoundingClientRect().top;
    for (const id of departingIds) {
      const el = listRef.current.querySelector<HTMLElement>(`[data-departing="${id}"]`);
      if (el) {
        const dist = targetY - el.getBoundingClientRect().top;
        el.style.setProperty("--fly-distance", `${dist}px`);
      }
    }
  }, [departingIds]);

  return {
    activeTasks,
    futureTasks,
    completedTasks,
    departingIds,
    activeWithDeparting,
    listRef,
    futureSectionRef,
  };
}
