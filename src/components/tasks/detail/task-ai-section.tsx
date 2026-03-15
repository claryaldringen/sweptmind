"use client";

import { useState } from "react";
import { gql } from "@apollo/client";
import { useMutation } from "@apollo/client/react";
import { Lightbulb, Loader2, ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const DECOMPOSE_TASK = gql`
  mutation DecomposeTask($taskId: String!) {
    decomposeTask(taskId: $taskId) {
      title
      listName
    }
  }
`;

interface DecomposeStep {
  title: string;
  listName: string | null;
}

interface TaskAiSectionProps {
  taskId: string;
  suggestion: string | null;
  onApplyDecomposition: (steps: DecomposeStep[]) => void;
  onDismiss: () => void;
}

export function TaskAiSection({
  taskId,
  suggestion,
  onApplyDecomposition,
  onDismiss,
}: TaskAiSectionProps) {
  const { t } = useTranslations();
  const [steps, setSteps] = useState<DecomposeStep[] | null>(null);
  const [error, setError] = useState(false);
  const [decomposeTask, { loading }] = useMutation<{
    decomposeTask: DecomposeStep[];
  }>(DECOMPOSE_TASK);

  async function handleDecompose() {
    setError(false);
    try {
      const result = await decomposeTask({ variables: { taskId } });
      const newSteps = result.data?.decomposeTask ?? [];
      setSteps(newSteps);
    } catch {
      setError(true);
    }
  }

  function handleRemoveStep(index: number) {
    if (!steps) return;
    setSteps(steps.filter((_, i) => i !== index));
  }

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

      {steps && steps.length > 0 && (
        <div className="space-y-2">
          <ol className="space-y-1.5">
            {steps.map((step, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="text-muted-foreground shrink-0 mt-0.5 w-4 text-right">{i + 1}.</span>
                <div className="min-w-0 flex-1">
                  <span className={cn(i === 0 && "font-medium")}>{step.title}</span>
                  {step.listName && (
                    <span className="text-muted-foreground text-xs ml-1">→ {step.listName}</span>
                  )}
                  {!step.listName && i > 0 && (
                    <span className="text-muted-foreground text-xs ml-1">({t("premium.aiDecomposeKeepInList")})</span>
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
              onClick={() => onApplyDecomposition(steps)}
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
