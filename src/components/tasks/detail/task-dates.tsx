"use client";

import { useState } from "react";
import { Calendar, Bell, CalendarRange } from "lucide-react";
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
  const [endDateOpen, setEndDateOpen] = useState(false);
  const [endPickerOpen, setEndPickerOpen] = useState(false);

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
            {dueDate
              ? t("tasks.dueDate", {
                  date: format(
                    parseISO(dueDate),
                    dueDate.includes("T") ? "MMM d, yyyy h:mm a" : "MMM d, yyyy",
                    { locale: dateFnsLocale },
                  ),
                })
              : t("tasks.addDueDate")}
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
        />
      </ResponsivePicker>

      {dueDate && !dueDateEnd && !endDateOpen && (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground w-full justify-start gap-2 text-xs"
          onClick={() => setEndDateOpen(true)}
        >
          <CalendarRange className="h-3.5 w-3.5" />
          {t("datePicker.addEndDate")}
        </Button>
      )}

      {dueDate && !dueDateEnd && endDateOpen && (
        <div className="flex gap-1 px-3 pb-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => {
              onQuickEndDate("1h");
              setEndDateOpen(false);
            }}
          >
            {t("datePicker.quickOneHour")}
          </Button>
          {parseISO(dueDate.split("T")[0]).getDay() !== 0 && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => {
                onQuickEndDate("sunday");
                setEndDateOpen(false);
              }}
            >
              {t("datePicker.quickUntilSunday")}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => {
              setEndPickerOpen(true);
              setEndDateOpen(false);
            }}
          >
            {t("datePicker.quickCustom")}
          </Button>
        </div>
      )}

      {dueDate && dueDateEnd && (
        <ResponsivePicker
          open={endPickerOpen}
          onOpenChange={setEndPickerOpen}
          title={t("datePicker.endDate")}
          trigger={
            <Button variant="ghost" className={cn("w-full justify-start gap-2", "text-blue-500")}>
              <CalendarRange className="h-4 w-4" />
              {t("datePicker.endDate")}:{" "}
              {format(
                parseISO(dueDateEnd),
                dueDateEnd.includes("T") ? "MMM d, yyyy h:mm a" : "MMM d, yyyy",
                { locale: dateFnsLocale },
              )}
            </Button>
          }
        >
          <DatePickerContent
            value={parseISO(dueDateEnd)}
            hasTime={dueDateEnd.includes("T")}
            timeValue={dueDateEnd.includes("T") ? dueDateEnd.split("T")[1] : ""}
            onDateSelect={onEndDateSelect}
            onTimeChange={onEndTimeChange}
            onClear={onClearEndDate}
            onClose={() => setEndPickerOpen(false)}
            t={t}
            dateFnsLocale={dateFnsLocale}
            showTimeToggle
          />
        </ResponsivePicker>
      )}

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
