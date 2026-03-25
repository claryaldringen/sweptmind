import { useEffect, useRef, useState } from "react";
import { gql } from "@apollo/client";
import { useMutation } from "@apollo/client/react";
import { useTranslations } from "@/lib/i18n";

const ANALYZE_TASK = gql`
  mutation AnalyzeTask($taskId: String!, $locale: String) {
    analyzeTask(taskId: $taskId, locale: $locale) {
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
      shoppingDistribution {
        stepId
        stepTitle
        suggestions {
          action
          target
          targetId
          confidence
          reason
        }
      }
      analyzedTitle
    }
  }
`;

interface AnalyzableTask {
  id: string;
  title: string;
  isCompleted: boolean;
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
    suggestedTitle: string | null;
    projectName: string | null;
    decomposition: { title: string; listName: string | null; dependsOn: number | null }[] | null;
    duplicateTaskId: string | null;
    callIntent: { name: string; reason: string | null } | null;
    analyzedTitle: string;
  } | null;
}

export function useTaskAnalysis(
  tasks: AnalyzableTask[],
  isPremium: boolean,
  allTasks?: AnalyzableTask[],
) {
  const { locale } = useTranslations();
  const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(new Set());
  const analyzedRef = useRef<Set<string>>(new Set());
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  const allTasksRef = useRef(allTasks);
  allTasksRef.current = allTasks;
  const busyRef = useRef(false);
  const disabledRef = useRef(false);

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
                  shoppingDistribution {
                    stepId
                    stepTitle
                    suggestions {
                      action
                      target
                      targetId
                      confidence
                      reason
                    }
                  }
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
      if (busyRef.current || disabledRef.current) return;

      const filterNeedsAnalysis = (list: AnalyzableTask[]) =>
        list.filter(
          (t) =>
            !t.isCompleted &&
            !analyzedRef.current.has(t.id) &&
            (!t.aiAnalysis || t.aiAnalysis.analyzedTitle !== t.title),
        );

      // Priority: current list first, then remaining tasks
      let needsAnalysis = filterNeedsAnalysis(tasksRef.current);
      if (needsAnalysis.length === 0 && allTasksRef.current) {
        needsAnalysis = filterNeedsAnalysis(allTasksRef.current);
      }

      if (needsAnalysis.length === 0) return;

      const task = needsAnalysis[0];
      analyzedRef.current.add(task.id);
      setAnalyzingIds((prev) => new Set(prev).add(task.id));
      busyRef.current = true;

      try {
        await analyzeTask({ variables: { taskId: task.id, locale } });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (
          msg.includes("AI is not configured") ||
          msg.includes("not configured") ||
          msg.includes("Monthly AI analysis limit reached")
        ) {
          // Stop polling entirely — AI is not available or budget exhausted
          disabledRef.current = true;
        } else {
          analyzedRef.current.delete(task.id);
        }
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
  }, [isPremium, analyzeTask, locale]);

  return analyzingIds;
}
