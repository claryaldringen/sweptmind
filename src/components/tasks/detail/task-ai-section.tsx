"use client";

import { useState } from "react";
import { gql } from "@apollo/client";
import { useMutation } from "@apollo/client/react";
import { Lightbulb, Loader2, ArrowRight, X, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const DECOMPOSE_TASK = gql`
  mutation DecomposeTask($taskId: String!) {
    decomposeTask(taskId: $taskId) {
      projectName
      steps {
        title
        listName
        dependsOn
      }
    }
  }
`;

interface DecomposeStep {
  title: string;
  listName: string | null;
  dependsOn: number | null;
}

interface DecomposeResult {
  projectName: string;
  steps: DecomposeStep[];
}

interface TaskAiSectionProps {
  taskId: string;
  suggestion: string | null;
  onApplyDecomposition: (result: DecomposeResult) => void;
  onDismiss: () => void;
}

export function TaskAiSection({
  taskId,
  suggestion,
  onApplyDecomposition,
  onDismiss,
}: TaskAiSectionProps) {
  const { t } = useTranslations();
  const [result, setResult] = useState<DecomposeResult | null>(null);
  const [error, setError] = useState(false);
  const [decomposeTask, { loading }] = useMutation<{
    decomposeTask: DecomposeResult;
  }>(DECOMPOSE_TASK);

  async function handleDecompose() {
    setError(false);
    try {
      const res = await decomposeTask({ variables: { taskId } });
      if (res.data?.decomposeTask) {
        setResult(res.data.decomposeTask);
      }
    } catch {
      setError(true);
    }
  }

  function handleRemoveStep(index: number) {
    if (!result) return;
    // When removing a step, update dependsOn references
    const newSteps = result.steps
      .filter((_, i) => i !== index)
      .map((step) => ({
        ...step,
        dependsOn:
          step.dependsOn === null
            ? null
            : step.dependsOn === index
              ? null // dependency removed
              : step.dependsOn > index
                ? step.dependsOn - 1 // shift index down
                : step.dependsOn,
      }));
    setResult({ ...result, steps: newSteps });
  }

  const steps = result?.steps ?? null;

  return (
    <div className="bg-yellow-50 dark:bg-yellow-950/20 rounded-lg p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-yellow-500 shrink-0" />
        <span className="text-sm font-medium">{t("premium.aiSuggestion")}</span>
      </div>

      {suggestion && !steps && (
        <p className="text-sm text-muted-foreground">{suggestion}</p>
      )}

      {!steps && !loading && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleDecompose}
          className="w-full"
        >
          <ArrowRight className="h-3.5 w-3.5" />
          {t("premium.aiDecompose")}
        </Button>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {t("premium.aiDecomposing")}
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive">{t("premium.aiDecomposeError")}</p>
      )}

      {steps && steps.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("premium.aiDecomposeEmpty")}</p>
      )}

      {steps && steps.length > 0 && result && (
        <div className="space-y-2">
          {result.projectName && (
            <p className="text-xs text-muted-foreground">
              Tag: <span className="font-medium">{result.projectName}</span>
            </p>
          )}
          <ol className="space-y-1.5">
            {steps.map((step, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="text-muted-foreground shrink-0 mt-0.5 w-4 text-right">{i + 1}.</span>
                <div className="min-w-0 flex-1">
                  <span className={cn(i === 0 && "font-medium")}>{step.title}</span>
                  {step.listName && (
                    <span className="text-muted-foreground text-xs ml-1">→ {step.listName}</span>
                  )}
                  {step.dependsOn !== null && (
                    <span className="text-muted-foreground text-xs ml-1">
                      <Link2 className="inline h-2.5 w-2.5" /> {step.dependsOn + 1}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveStep(i)}
                  className="text-muted-foreground hover:text-foreground shrink-0 mt-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ol>
          <div className="flex gap-2">
            <Button
              variant="default"
              size="sm"
              className="flex-1"
              onClick={() => onApplyDecomposition(result)}
            >
              {t("premium.aiDecomposeApply")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
            >
              {t("premium.aiDecomposeCancel")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
