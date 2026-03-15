"use client";

import { useState } from "react";
import { Calendar, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResponsivePicker } from "@/components/ui/responsive-picker";
import { DatePickerContent } from "@/components/tasks/date-picker-content";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import type { Locale as DateFnsLocale } from "date-fns";

interface TaskDatesProps {
  dueDate: string | null;
  dueDateEnd: string | null;
  reminderAt: string | null;
  onDateSelect: (date: Date | undefined) => void;
  onTimeChange: (time: string) => void;
  onClearDueDate: () => void;
  onReminderSelect: (date: Date | undefined) => void;
  onClearReminder: () => void;
  onEndDateSelect: (date: Date | undefined) => void;
  onEndTimeChange: (time: string) => void;
  onClearEndDate: () => void;
  onQuickEndDate: (type: "1h" | "sunday") => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  dateFnsLocale: DateFnsLocale;
}

export function TaskDates({
  dueDate,
  dueDateEnd,
  reminderAt,
  onDateSelect,
  onTimeChange,
  onClearDueDate,
  onReminderSelect,
  onClearReminder,
  onEndDateSelect,
  onEndTimeChange,
  onClearEndDate,
  onQuickEndDate,
  t,
  dateFnsLocale,
}: TaskDatesProps) {
  const [dueDateOpen, setDueDateOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);

  const dueDateLabel = dueDate
    ? dueDateEnd
      ? `${format(parseISO(dueDate), dueDate.includes("T") ? "MMM d, yyyy h:mm a" : "MMM d, yyyy", { locale: dateFnsLocale })} – ${format(parseISO(dueDateEnd), dueDateEnd.includes("T") ? "MMM d, yyyy h:mm a" : "MMM d, yyyy", { locale: dateFnsLocale })}`
      : format(
          parseISO(dueDate),
          dueDate.includes("T") ? "MMM d, yyyy h:mm a" : "MMM d, yyyy",
          { locale: dateFnsLocale },
        )
    : null;

  return (
    <>
      <ResponsivePicker
        open={dueDateOpen}
        onOpenChange={setDueDateOpen}
        title={t("datePicker.dueDate")}
        trigger={
          <Button
            variant="ghost"
            className={cn("w-full justify-start gap-2", dueDate && "text-blue-500")}
          >
            <Calendar className="h-4 w-4" />
            {dueDateLabel ? t("tasks.dueDate", { date: dueDateLabel }) : t("tasks.addDueDate")}
          </Button>
        }
      >
        <DatePickerContent
          value={dueDate ? parseISO(dueDate) : undefined}
          hasTime={dueDate?.includes("T") ?? false}
          timeValue={dueDate?.includes("T") ? dueDate.split("T")[1] : ""}
          onDateSelect={onDateSelect}
          onTimeChange={onTimeChange}
          onClear={onClearDueDate}
          onClose={() => setDueDateOpen(false)}
          t={t}
          dateFnsLocale={dateFnsLocale}
          showTimeToggle
          // End date props
          endValue={dueDateEnd ? parseISO(dueDateEnd) : undefined}
          endHasTime={dueDateEnd?.includes("T") ?? false}
          endTimeValue={dueDateEnd?.includes("T") ? dueDateEnd.split("T")[1] : ""}
          onEndDateSelect={onEndDateSelect}
          onEndTimeChange={onEndTimeChange}
          onClearEndDate={onClearEndDate}
          onQuickEndDate={onQuickEndDate}
          dueDateStr={dueDate}
        />
      </ResponsivePicker>

      <ResponsivePicker
        open={reminderOpen}
        onOpenChange={setReminderOpen}
        title={t("datePicker.reminder")}
        trigger={
          <Button
            variant="ghost"
            className={cn("w-full justify-start gap-2", reminderAt && "text-blue-500")}
          >
            <Bell className="h-4 w-4" />
            {reminderAt
              ? t("tasks.reminder", {
                  date: format(parseISO(reminderAt), "MMM d, yyyy", {
                    locale: dateFnsLocale,
                  }),
                })
              : t("tasks.addReminder")}
          </Button>
        }
      >
        <DatePickerContent
          value={reminderAt ? parseISO(reminderAt) : undefined}
          hasTime={false}
          timeValue=""
          onDateSelect={onReminderSelect}
          onClear={onClearReminder}
          onClose={() => setReminderOpen(false)}
          t={t}
          dateFnsLocale={dateFnsLocale}
          showTimeToggle={false}
        />
      </ResponsivePicker>
    </>
  );
}
