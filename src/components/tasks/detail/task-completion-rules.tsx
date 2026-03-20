"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslations } from "@/lib/i18n";

interface TaskCompletionRulesProps {
  mode: string | null;
  action: string | null;
  listId: string | null;
  lists: { id: string; name: string }[];
  onModeChange: (mode: string | null) => void;
  onActionChange: (action: string | null) => void;
  onListChange: (listId: string | null) => void;
}

export function TaskCompletionRules({
  mode,
  action,
  listId,
  lists,
  onModeChange,
  onActionChange,
  onListChange,
}: TaskCompletionRulesProps) {
  const { t } = useTranslations();

  return (
    <div className="space-y-2 px-3 py-2">
      <p className="text-muted-foreground text-xs font-medium">
        {t("sharing.completionRules")}
      </p>

      {/* Mode: when is it done? */}
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground w-24 shrink-0 text-xs">
          {t("sharing.completionMode")}
        </span>
        <Select
          value={mode ?? "none"}
          onValueChange={(v) => {
            if (v === "none") {
              onModeChange(null);
              onActionChange(null);
              onListChange(null);
            } else {
              onModeChange(v);
              if (!action) onActionChange("complete");
            }
          }}
        >
          <SelectTrigger className="h-7 flex-1 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t("sharing.completionNoRule")}</SelectItem>
            <SelectItem value="any">{t("sharing.completionModeAny")}</SelectItem>
            <SelectItem value="all">{t("sharing.completionModeAll")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Action: what happens? */}
      {mode && (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground w-24 shrink-0 text-xs">
            {t("sharing.completionAction")}
          </span>
          <Select
            value={action ?? "complete"}
            onValueChange={(v) => {
              onActionChange(v);
              if (v !== "move") onListChange(null);
            }}
          >
            <SelectTrigger className="h-7 flex-1 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="complete">
                {t("sharing.completionActionComplete")}
              </SelectItem>
              <SelectItem value="move">
                {t("sharing.completionActionMove")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* List picker */}
      {mode && action === "move" && (
        <div className="flex items-center gap-2">
          <span className="w-24 shrink-0" />
          <Select
            value={listId ?? ""}
            onValueChange={(v) => onListChange(v || null)}
          >
            <SelectTrigger className="h-7 flex-1 text-xs">
              <SelectValue placeholder={t("sharing.completionSelectList")} />
            </SelectTrigger>
            <SelectContent>
              {lists.map((list) => (
                <SelectItem key={list.id} value={list.id}>
                  {list.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
