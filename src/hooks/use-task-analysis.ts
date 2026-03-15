import { useEffect, useRef, useState } from "react";
import { gql } from "@apollo/client";
import { useMutation } from "@apollo/client/react";

const ANALYZE_TASK = gql`
  mutation AnalyzeTask($taskId: String!) {
    analyzeTask(taskId: $taskId) {
      id
      taskId
      isActionable
      suggestion
      analyzedTitle
    }
  }
`;

interface AnalyzableTask {
  id: string;
  title: string;
  aiAnalysis?: {
    analyzedTitle: string;
  } | null;
}

interface AnalyzeTaskResult {
  analyzeTask: {
    id: string;
    taskId: string;
    isActionable: boolean;
    suggestion: string | null;
    analyzedTitle: string;
  } | null;
}

export function useTaskAnalysis(tasks: AnalyzableTask[], isPremium: boolean) {
  const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(new Set());
  const analyzedRef = useRef<Set<string>>(new Set());
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  const busyRef = useRef(false);

  const [analyzeTask] = useMutation<AnalyzeTaskResult>(ANALYZE_TASK, {
    update(cache, { data }) {
      if (!data?.analyzeTask) return;
      const analysis = data.analyzeTask;
      cache.modify({
        id: cache.identify({ __typename: "Task", id: analysis.taskId }),
        fields: {
          aiAnalysis() {
            return cache.writeFragment({
              data: analysis,
              fragment: gql`
                fragment NewAiAnalysis on TaskAiAnalysis {
                  id
                  taskId
                  isActionable
                  suggestion
                  analyzedTitle
                }
              `,
            });
          },
        },
      });
    },
  });

  useEffect(() => {
    if (!isPremium) return;

    const interval = setInterval(async () => {
      if (busyRef.current) return;

      const currentTasks = tasksRef.current;
      const needsAnalysis = currentTasks.filter(
        (t) =>
          !analyzedRef.current.has(t.id) &&
          (!t.aiAnalysis || t.aiAnalysis.analyzedTitle !== t.title),
      );

      if (needsAnalysis.length === 0) return;

      const task = needsAnalysis[0];
      analyzedRef.current.add(task.id);
      setAnalyzingIds((prev) => new Set(prev).add(task.id));
      busyRef.current = true;

      try {
        await analyzeTask({ variables: { taskId: task.id } });
      } catch {
        analyzedRef.current.delete(task.id);
      } finally {
        busyRef.current = false;
        setAnalyzingIds((prev) => {
          const next = new Set(prev);
          next.delete(task.id);
          return next;
        });
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isPremium, analyzeTask]);

  return analyzingIds;
}
