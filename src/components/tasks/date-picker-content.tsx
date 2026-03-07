"use client";

import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Clock, X } from "lucide-react";
import { addDays, startOfDay, nextMonday, format } from "date-fns";
import type { Locale as DateFnsLocale } from "date-fns";

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

interface DatePickerContentProps {
  value: Date | undefined;
  hasTime: boolean;
  timeValue: string;
  onDateSelect: (date: Date | undefined) => void;
  onTimeChange?: (time: string) => void;
  onClear: () => void;
  onClose?: () => void;
  t: TranslateFn;
  dateFnsLocale: DateFnsLocale;
  showTimeToggle?: boolean;
}

export function DatePickerContent({
  value,
  hasTime,
  timeValue,
  onDateSelect,
  onTimeChange,
  onClear,
  onClose,
  t,
  dateFnsLocale,
  showTimeToggle = true,
}: DatePickerContentProps) {
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);
  const nextWeekDay = nextMonday(today);

  function handlePreset(date: Date) {
    onDateSelect(date);
    onClose?.();
  }

  function handleCalendarSelect(date: Date | undefined) {
    onDateSelect(date);
    if (date) onClose?.();
  }

  function handleClear() {
    onClear();
    onClose?.();
  }

  return (
    <div className="flex flex-col">
      {/* Quick presets */}
      <div className="flex gap-2 p-3">
        <Button
          variant="outline"
          size="sm"
          className="h-9 flex-1 md:h-8"
          onClick={() => handlePreset(today)}
        >
          {t("datePicker.today")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-9 flex-1 md:h-8"
          onClick={() => handlePreset(tomorrow)}
        >
          {t("datePicker.tomorrow")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-9 flex-1 md:h-8"
          onClick={() => handlePreset(nextWeekDay)}
        >
          {t("datePicker.nextWeek")}
        </Button>
      </div>

      <Separator />

      {/* Calendar */}
      <CalendarComponent
        mode="single"
        locale={dateFnsLocale}
        selected={value}
        onSelect={handleCalendarSelect}
        defaultMonth={value}
      />

      {/* Time toggle */}
      {showTimeToggle && (
        <>
          <Separator />
          <div className="flex items-center gap-2 px-3 py-2">
            <Clock className="text-muted-foreground h-4 w-4" />
            {hasTime ? (
              <>
                <input
                  type="time"
                  value={timeValue}
                  onChange={(e) => onTimeChange?.(e.target.value)}
                  className="text-foreground h-9 bg-transparent text-sm outline-none md:h-8"
                />
                <button
                  onClick={() => onTimeChange?.("")}
                  className="text-muted-foreground hover:text-foreground ml-auto"
                  title={t("datePicker.removeTime")}
                >
                  <X className="h-4 w-4" />
                </button>
              </>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 md:h-8"
                onClick={() => onTimeChange?.(format(new Date(), "HH:mm"))}
              >
                {t("datePicker.addTime")}
              </Button>
            )}
          </div>
        </>
      )}

      {/* Remove date */}
      {value && (
        <>
          <Separator />
          <div className="p-3">
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-full text-red-500 hover:text-red-600 md:h-8"
              onClick={handleClear}
            >
              {t("datePicker.removeDate")}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
