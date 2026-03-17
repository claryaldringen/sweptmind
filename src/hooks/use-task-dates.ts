import { useCallback } from "react";
import { format, parseISO, addHours, addDays } from "date-fns";

interface UseTaskDatesOptions {
  dueDate: string | null;
  dueDateEnd: string | null;
  optimisticUpdate: (input: Record<string, unknown>) => void;
}

export function useTaskDates({ dueDate, dueDateEnd, optimisticUpdate }: UseTaskDatesOptions) {
  const handleDateSelect = useCallback(
    (date: Date | undefined) => {
      if (!date) {
        optimisticUpdate({ dueDate: null });
        return;
      }
      const existingTime = dueDate?.includes("T") ? dueDate.split("T")[1] : null;
      const dateStr = format(date, "yyyy-MM-dd");
      const newDueDate = existingTime ? `${dateStr}T${existingTime}` : dateStr;
      optimisticUpdate({ dueDate: newDueDate });
    },
    [dueDate, optimisticUpdate],
  );

  const handleTimeChange = useCallback(
    (time: string) => {
      if (!dueDate) return;
      const dateStr = dueDate.split("T")[0];
      const newDueDate = time ? `${dateStr}T${time}` : dateStr;
      optimisticUpdate({ dueDate: newDueDate });
    },
    [dueDate, optimisticUpdate],
  );

  const handleReminderSelect = useCallback(
    (date: Date | undefined) => {
      if (!date) {
        optimisticUpdate({ reminderAt: null });
        return;
      }
      const reminderAt = format(date, "yyyy-MM-dd");
      optimisticUpdate({ reminderAt });
    },
    [optimisticUpdate],
  );

  const handleEndDateSelect = useCallback(
    (date: Date | undefined) => {
      if (!date) return;
      optimisticUpdate({ dueDateEnd: format(date, "yyyy-MM-dd") });
    },
    [optimisticUpdate],
  );

  const handleEndTimeChange = useCallback(
    (time: string) => {
      if (!dueDateEnd) return;
      const dateStr = dueDateEnd.split("T")[0];
      optimisticUpdate({ dueDateEnd: time ? `${dateStr}T${time}` : dateStr });
    },
    [dueDateEnd, optimisticUpdate],
  );

  const handleClearEndDate = useCallback(() => {
    optimisticUpdate({ dueDateEnd: null });
  }, [optimisticUpdate]);

  const handleQuickEndDate = useCallback(
    (type: "1h" | "sunday") => {
      if (!dueDate) return;
      if (type === "1h") {
        const hasTime = dueDate.includes("T");
        if (hasTime) {
          const start = parseISO(dueDate);
          const end = addHours(start, 1);
          optimisticUpdate({ dueDateEnd: format(end, "yyyy-MM-dd'T'HH:mm") });
        } else {
          optimisticUpdate({ dueDateEnd: dueDate + "T01:00" });
        }
      } else if (type === "sunday") {
        const start = parseISO(dueDate.split("T")[0]);
        const dayOfWeek = start.getDay();
        const daysToSunday = dayOfWeek === 0 ? 7 : 7 - dayOfWeek;
        const sunday = addDays(start, daysToSunday);
        optimisticUpdate({ dueDateEnd: format(sunday, "yyyy-MM-dd") });
      }
    },
    [dueDate, optimisticUpdate],
  );

  return {
    handleDateSelect,
    handleTimeChange,
    handleReminderSelect,
    handleEndDateSelect,
    handleEndTimeChange,
    handleClearEndDate,
    handleQuickEndDate,
  };
}
