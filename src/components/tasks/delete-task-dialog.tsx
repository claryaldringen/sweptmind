"use client";

import { useCallback, useEffect, useState } from "react";
import { useApolloClient } from "@apollo/client/react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { TASKS_IN_GOOGLE_CALENDAR } from "@/graphql/shared/task-mutations";
import { useTranslations } from "@/lib/i18n";

/** Resolves which of the tasks have a Google Calendar event (none on error). */
export function useTasksInGoogleCalendar() {
  const client = useApolloClient();
  return useCallback(
    async (ids: string[]): Promise<string[]> => {
      if (ids.length === 0) return [];
      try {
        const { data } = await client.query<{ tasksInGoogleCalendar: string[] }>({
          query: TASKS_IN_GOOGLE_CALENDAR,
          variables: { ids },
          fetchPolicy: "network-only",
        });
        return data?.tasksInGoogleCalendar ?? [];
      } catch {
        return [];
      }
    },
    [client],
  );
}

interface DeleteTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskIds: string[];
  /** Task ids known to be in Google Calendar; checked on open when omitted. */
  calendarTaskIds?: string[];
  onConfirm: (deleteFromCalendar: boolean) => void;
}

/**
 * Delete confirmation. Tasks that are also in Google Calendar get a choice: delete only
 * in SweptMind, or remove the calendar event too.
 */
export function DeleteTaskDialog({
  open,
  onOpenChange,
  taskIds,
  calendarTaskIds,
  onConfirm,
}: DeleteTaskDialogProps) {
  const { t } = useTranslations();
  const findTasksInCalendar = useTasksInGoogleCalendar();
  const [checked, setChecked] = useState<{ key: string; ids: string[] } | null>(null);
  const idsKey = taskIds.join(",");

  useEffect(() => {
    if (!open || calendarTaskIds) return;
    let cancelled = false;
    findTasksInCalendar(idsKey.split(",").filter(Boolean)).then((ids) => {
      if (!cancelled) setChecked({ key: idsKey, ids });
    });
    return () => {
      cancelled = true;
    };
  }, [open, idsKey, calendarTaskIds, findTasksInCalendar]);

  const inCalendar = calendarTaskIds ?? (checked?.key === idsKey ? checked.ids : null);
  const checking = inCalendar === null;
  const bulk = taskIds.length > 1;

  const confirm = (deleteFromCalendar: boolean) => {
    onOpenChange(false);
    onConfirm(deleteFromCalendar);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("common.deleteConfirmTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {bulk
              ? t("tasks.bulkDeleteConfirmDesc", { count: taskIds.length })
              : t("tasks.deleteConfirmDesc")}
          </AlertDialogDescription>
          {inCalendar && inCalendar.length > 0 && (
            <AlertDialogDescription className="text-foreground font-medium">
              {bulk
                ? t("tasks.bulkDeleteInCalendarNote", { count: inCalendar.length })
                : t("tasks.deleteInCalendarNote")}
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.deleteConfirmCancel")}</AlertDialogCancel>
          {inCalendar && inCalendar.length > 0 ? (
            <>
              <Button variant="outline" onClick={() => confirm(false)}>
                {t("tasks.deleteOnlyHere")}
              </Button>
              <Button variant="destructive" onClick={() => confirm(true)}>
                {t("tasks.deleteAlsoInCalendar")}
              </Button>
            </>
          ) : (
            <Button variant="destructive" disabled={checking} onClick={() => confirm(false)}>
              {t("common.deleteConfirmAction")}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Bulk delete: deletes right away when no task is in Google Calendar (as before),
 * otherwise opens the dialog with the calendar choice.
 */
export function useBulkDeleteWithCalendarChoice(
  performDelete: (ids: string[], deleteFromCalendar: boolean) => void,
) {
  const findTasksInCalendar = useTasksInGoogleCalendar();
  const [pending, setPending] = useState<{ ids: string[]; inCalendar: string[] } | null>(null);

  const requestDelete = useCallback(
    async (ids: string[]) => {
      const inCalendar = await findTasksInCalendar(ids);
      if (inCalendar.length === 0) performDelete(ids, false);
      else setPending({ ids, inCalendar });
    },
    [findTasksInCalendar, performDelete],
  );

  const dialog = (
    <DeleteTaskDialog
      open={pending !== null}
      onOpenChange={(open) => {
        if (!open) setPending(null);
      }}
      taskIds={pending?.ids ?? []}
      calendarTaskIds={pending?.inCalendar ?? []}
      onConfirm={(deleteFromCalendar) => {
        if (pending) performDelete(pending.ids, deleteFromCalendar);
      }}
    />
  );

  return { requestDelete, dialog };
}
