"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Lightbulb,
  X,
  Link2,
  Pencil,
  Copy,
  Trash2,
  Phone,
  ShoppingCart,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { getContactsAdapter } from "@sweptmind/native-bridge";
import type { Contact } from "@sweptmind/native-bridge";

interface DecomposeStep {
  title: string;
  listName: string | null;
  dependsOn: number | null;
}

interface DecomposeResult {
  projectName: string;
  steps: DecomposeStep[];
}

interface CallIntent {
  name: string;
  reason: string | null;
}

interface ShoppingItemSuggestion {
  action: string;
  target: string;
  targetId: string | null;
  confidence: number;
  reason: string;
}

interface ShoppingItem {
  stepId: string | null;
  stepTitle: string;
  suggestions: ShoppingItemSuggestion[];
}

interface TaskAiSectionProps {
  taskId: string;
  suggestedTitle: string | null;
  projectName: string | null;
  decomposition: DecomposeStep[] | null;
  duplicateTaskId: string | null;
  duplicateTaskTitle: string | null;
  callIntent: CallIntent | null;
  shoppingDistribution: ShoppingItem[] | null;
  onApplyDecomposition: (result: DecomposeResult) => void;
  onApplyRename: (title: string) => void;
  onDeleteDuplicate: () => void;
  onNavigateToDuplicate: (taskId: string) => void;
  onApplyShoppingItem: (item: ShoppingItem, suggestion: ShoppingItemSuggestion) => void;
  onApplyAllShopping: (items: ShoppingItem[]) => void;
  onDismiss: () => void;
}

function CallIntentSection({ callIntent }: { callIntent: CallIntent }) {
  const { t } = useTranslations();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const adapter = useMemo(() => getContactsAdapter(), []);
  const supported = adapter.isSupported();

  useEffect(() => {
    if (supported) {
      adapter
        .searchByName(callIntent.name)
        .then(setContacts)
        .catch(() => {});
    }
  }, [callIntent.name, adapter, supported]);

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <Phone className="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0" />
        <div className="text-sm">
          <span className="font-medium">
            {t("premium.aiCallIntent")}: {callIntent.name}
          </span>
          {callIntent.reason && (
            <p className="text-muted-foreground mt-0.5 text-xs">
              {t("premium.aiCallIntentReason")} {callIntent.reason}
            </p>
          )}
        </div>
      </div>

      {supported && contacts.length > 0 && (
        <div className="ml-5 space-y-1.5">
          {contacts.map((contact, i) => (
            <div key={i} className="space-y-1">
              <p className="text-xs font-medium">{contact.name}</p>
              {contact.phones.map((phone: string, j: number) => (
                <a
                  key={j}
                  href={`tel:${phone}`}
                  className="text-primary flex items-center gap-2 text-sm hover:underline"
                >
                  <Phone className="h-3 w-3" />
                  {phone}
                </a>
              ))}
            </div>
          ))}
        </div>
      )}

      {!supported && (
        <p className="text-muted-foreground ml-5 text-xs">{t("premium.aiCallIntentNoContacts")}</p>
      )}
    </div>
  );
}

function ShoppingSuggestionPicker({
  suggestions,
  onSelect,
}: {
  suggestions: ShoppingItemSuggestion[];
  onSelect: (s: ShoppingItemSuggestion) => void;
}) {
  const { t } = useTranslations();
  const [open, setOpen] = useState(false);
  const primary = suggestions[0];

  if (suggestions.length === 1) {
    return (
      <Button variant="outline" size="sm" className="shrink-0" onClick={() => onSelect(primary)}>
        &rarr; {primary.target}
      </Button>
    );
  }

  return (
    <div className="relative shrink-0">
      <Button variant="outline" size="sm" onClick={() => setOpen(!open)}>
        &rarr; {primary.target}
        <ChevronDown className="ml-1 h-3 w-3" />
      </Button>
      {open && (
        <div className="bg-popover border-border absolute top-full right-0 z-10 mt-1 min-w-48 rounded-md border p-1 shadow-md">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              className="hover:bg-accent flex w-full flex-col items-start rounded-sm px-2 py-1.5 text-left text-sm"
              onClick={() => {
                onSelect(s);
                setOpen(false);
              }}
            >
              <span className="font-medium">
                {s.action === "add_to_task"
                  ? `${t("premium.aiShoppingAddToTask")} ${s.target}`
                  : `${t("premium.aiShoppingCreateInList")} ${s.target}`}
              </span>
              <span className="text-muted-foreground text-xs">{s.reason}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function TaskAiSection({
  suggestedTitle,
  projectName,
  decomposition,
  duplicateTaskId,
  duplicateTaskTitle,
  callIntent,
  shoppingDistribution,
  onApplyDecomposition,
  onApplyRename,
  onDeleteDuplicate,
  onNavigateToDuplicate,
  onApplyShoppingItem,
  onApplyAllShopping,
  onDismiss,
}: TaskAiSectionProps) {
  const { t } = useTranslations();
  const [steps, setSteps] = useState<DecomposeStep[] | null>(decomposition);

  function handleRemoveStep(index: number) {
    if (!steps) return;
    const newSteps = steps
      .filter((_, i) => i !== index)
      .map((step) => ({
        ...step,
        dependsOn:
          step.dependsOn === null
            ? null
            : step.dependsOn === index
              ? null
              : step.dependsOn > index
                ? step.dependsOn - 1
                : step.dependsOn,
      }));
    setSteps(newSteps);
  }

  // --- Duplicate detection ---
  if (duplicateTaskId) {
    return (
      <div className="space-y-3 rounded-lg bg-yellow-50 p-3 dark:bg-yellow-950/20">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 shrink-0 text-yellow-500" />
          <span className="text-sm font-medium">{t("premium.aiSuggestion")}</span>
        </div>

        <div className="flex items-start gap-2">
          <Copy className="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p className="text-sm">
            {t("premium.aiDuplicate")}{" "}
            <button
              type="button"
              onClick={() => onNavigateToDuplicate(duplicateTaskId)}
              className="hover:text-foreground font-medium underline underline-offset-2"
            >
              {duplicateTaskTitle ?? duplicateTaskId}
            </button>
          </p>
        </div>

        {callIntent && <CallIntentSection callIntent={callIntent} />}

        <div className="flex gap-2">
          <Button variant="destructive" size="sm" className="flex-1" onClick={onDeleteDuplicate}>
            <Trash2 className="h-3.5 w-3.5" />
            {t("premium.aiDuplicateDelete")}
          </Button>
          <Button variant="ghost" size="sm" onClick={onDismiss}>
            {t("premium.aiDecomposeCancel")}
          </Button>
        </div>
      </div>
    );
  }

  // --- Call intent only (actionable task with call intent) ---
  if (callIntent && !suggestedTitle && !decomposition?.length) {
    return (
      <div className="space-y-3 rounded-lg bg-yellow-50 p-3 dark:bg-yellow-950/20">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 shrink-0 text-yellow-500" />
          <span className="text-sm font-medium">{t("premium.aiSuggestion")}</span>
        </div>

        <CallIntentSection callIntent={callIntent} />

        <Button variant="ghost" size="sm" onClick={onDismiss}>
          {t("premium.aiDecomposeCancel")}
        </Button>
      </div>
    );
  }

  // --- Shopping distribution ---
  if (shoppingDistribution && shoppingDistribution.length > 0) {
    return (
      <div className="space-y-3 rounded-lg bg-yellow-50 p-3 dark:bg-yellow-950/20">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 shrink-0 text-yellow-500" />
          <span className="text-sm font-medium">{t("premium.aiShoppingTitle")}</span>
        </div>

        <div className="space-y-2">
          {shoppingDistribution.map((item, i) => {
            const primary = item.suggestions[0];
            const hasAlternatives = item.suggestions.length > 1;
            const isHighConfidence = primary.confidence >= 0.8;

            return (
              <div key={i} className="flex items-center justify-between gap-2">
                <span className="min-w-0 flex-1 truncate text-sm">{item.stepTitle}</span>
                {isHighConfidence && !hasAlternatives ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => onApplyShoppingItem(item, primary)}
                  >
                    &rarr; {primary.target}
                  </Button>
                ) : (
                  <ShoppingSuggestionPicker
                    suggestions={item.suggestions}
                    onSelect={(s) => onApplyShoppingItem(item, s)}
                  />
                )}
              </div>
            );
          })}
        </div>

        {callIntent && <CallIntentSection callIntent={callIntent} />}

        <div className="flex gap-2">
          <Button
            variant="default"
            size="sm"
            className="flex-1"
            onClick={() => onApplyAllShopping(shoppingDistribution)}
          >
            {t("premium.aiShoppingApplyAll")}
          </Button>
          <Button variant="ghost" size="sm" onClick={onDismiss}>
            {t("premium.aiDecomposeCancel")}
          </Button>
        </div>
      </div>
    );
  }

  // --- Rename suggestion ---
  if (suggestedTitle) {
    return (
      <div className="space-y-3 rounded-lg bg-yellow-50 p-3 dark:bg-yellow-950/20">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 shrink-0 text-yellow-500" />
          <span className="text-sm font-medium">{t("premium.aiSuggestion")}</span>
        </div>

        <div className="flex items-start gap-2">
          <Pencil className="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p className="text-sm font-medium">{suggestedTitle}</p>
        </div>

        {callIntent && <CallIntentSection callIntent={callIntent} />}

        <div className="flex gap-2">
          <Button
            variant="default"
            size="sm"
            className="flex-1"
            onClick={() => onApplyRename(suggestedTitle)}
          >
            {t("premium.aiRenameApply")}
          </Button>
          <Button variant="ghost" size="sm" onClick={onDismiss}>
            {t("premium.aiDecomposeCancel")}
          </Button>
        </div>
      </div>
    );
  }

  // --- Decomposition ---
  return (
    <div className="space-y-3 rounded-lg bg-yellow-50 p-3 dark:bg-yellow-950/20">
      <div className="flex items-center gap-2">
        <Lightbulb className="h-4 w-4 shrink-0 text-yellow-500" />
        <span className="text-sm font-medium">{t("premium.aiSuggestion")}</span>
      </div>

      {steps && steps.length === 0 && (
        <p className="text-muted-foreground text-sm">{t("premium.aiDecomposeEmpty")}</p>
      )}

      {steps && steps.length > 0 && (
        <div className="space-y-2">
          {projectName && (
            <p className="text-muted-foreground text-xs">
              Tag: <span className="font-medium">{projectName}</span>
            </p>
          )}
          <ol className="space-y-1.5">
            {steps.map((step, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="text-muted-foreground mt-0.5 w-4 shrink-0 text-right">
                  {i + 1}.
                </span>
                <div className="min-w-0 flex-1">
                  <span className={cn(i === 0 && "font-medium")}>{step.title}</span>
                  {step.listName && (
                    <span className="text-muted-foreground ml-1 text-xs">→ {step.listName}</span>
                  )}
                  {step.dependsOn !== null && (
                    <span className="text-muted-foreground ml-1 text-xs">
                      <Link2 className="inline h-2.5 w-2.5" /> {step.dependsOn + 1}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveStep(i)}
                  className="text-muted-foreground hover:text-foreground mt-0.5 shrink-0"
                >
                  <X className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ol>

          {callIntent && <CallIntentSection callIntent={callIntent} />}

          <div className="flex gap-2">
            <Button
              variant="default"
              size="sm"
              className="flex-1"
              onClick={() => onApplyDecomposition({ projectName: projectName ?? "", steps })}
            >
              {t("premium.aiDecomposeApply")}
            </Button>
            <Button variant="ghost" size="sm" onClick={onDismiss}>
              {t("premium.aiDecomposeCancel")}
            </Button>
          </div>
        </div>
      )}

      {!steps && (
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          {t("premium.aiDecomposeCancel")}
        </Button>
      )}
    </div>
  );
}
