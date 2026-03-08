"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  pointerWithin,
  closestCenter,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { gql } from "@apollo/client";
import { useMutation } from "@apollo/client/react";

const UPDATE_TASK = gql`
  mutation UpdateTaskList($id: String!, $input: UpdateTaskInput!) {
    updateTask(id: $id, input: $input) {
      id
      listId
    }
  }
`;

type ReorderCallback = (activeId: string, overId: string) => void;

interface TaskDndContextValue {
  registerTaskReorder: (cb: ReorderCallback) => void;
  registerListReorder: (cb: ReorderCallback) => void;
  overListId: string | null;
  activeType: "task" | "list" | null;
}

const TaskDndContext = createContext<TaskDndContextValue | null>(null);

export function useTaskDnd() {
  const ctx = useContext(TaskDndContext);
  if (!ctx) throw new Error("useTaskDnd must be used within TaskDndProvider");
  return ctx;
}

interface ActiveDrag {
  id: string;
  type: "task" | "list";
  title: string;
}

// Use pointerWithin first (detects cursor over sidebar lists), fallback to closestCenter (for task reordering)
const collisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) return pointerCollisions;
  return closestCenter(args);
};

export function TaskDndProvider({ children }: { children: ReactNode }) {
  const taskReorderRef = useRef<ReorderCallback | null>(null);
  const listReorderRef = useRef<ReorderCallback | null>(null);
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);
  const [overListId, setOverListId] = useState<string | null>(null);
  const [updateTask] = useMutation(UPDATE_TASK);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const registerTaskReorder = useCallback((cb: ReorderCallback) => {
    taskReorderRef.current = cb;
  }, []);

  const registerListReorder = useCallback((cb: ReorderCallback) => {
    listReorderRef.current = cb;
  }, []);

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current;
    const type = data?.type as "task" | "list" | undefined;
    if (!type) return;
    setActiveDrag({
      id: String(event.active.id),
      type,
      title: data?.title ?? "",
    });
  }

  function handleDragOver(event: DragOverEvent) {
    if (!activeDrag || activeDrag.type !== "task") {
      setOverListId(null);
      return;
    }
    const overData = event.over?.data.current;
    if (overData?.type === "list") {
      setOverListId(String(event.over!.id));
    } else {
      setOverListId(null);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const activeData = active.data.current;
    const overData = over?.data.current;
    const activeType = activeData?.type as string | undefined;
    const overType = overData?.type as string | undefined;

    if (over && activeType === "task" && overType === "list") {
      // Task dropped on a list — move it
      const taskId = String(active.id);
      const newListId = String(over.id);
      const oldListId = activeData?.listId as string | undefined;
      updateTask({
        variables: { id: taskId, input: { listId: newListId } },
        update(cache) {
          // Remove from old list's tasksByList query
          if (oldListId) {
            cache.modify({
              fields: {
                tasksByList(existing = [], { storeFieldName, readField }) {
                  if (!storeFieldName.includes(oldListId)) return existing;
                  return existing.filter(
                    (ref: { __ref: string }) => readField("id", ref) !== taskId,
                  );
                },
              },
            });
          }
          // Add to new list's tasksByList query
          cache.modify({
            fields: {
              tasksByList(existing = [], { storeFieldName }) {
                if (!storeFieldName.includes(newListId)) return existing;
                const newRef = { __ref: `Task:${taskId}` };
                if (existing.some((ref: { __ref: string }) => ref.__ref === newRef.__ref))
                  return existing;
                return [...existing, newRef];
              },
            },
          });
        },
      });
    } else if (over && activeType === "task" && overType === "task" && active.id !== over.id) {
      // Task dropped on another task — reorder
      taskReorderRef.current?.(String(active.id), String(over.id));
    } else if (over && activeType === "list" && overType === "list" && active.id !== over.id) {
      // List dropped on another list — reorder
      listReorderRef.current?.(String(active.id), String(over.id));
    }

    setActiveDrag(null);
    setOverListId(null);
  }

  function handleDragCancel() {
    setActiveDrag(null);
    setOverListId(null);
  }

  const contextValue: TaskDndContextValue = {
    registerTaskReorder,
    registerListReorder,
    overListId,
    activeType: activeDrag?.type ?? null,
  };

  return (
    <TaskDndContext.Provider value={contextValue}>
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {children}
        <DragOverlay dropAnimation={null}>
          {activeDrag?.type === "task" ? (
            <div className="bg-background rounded-md border px-4 py-2 text-sm shadow-lg">
              {activeDrag.title}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </TaskDndContext.Provider>
  );
}
