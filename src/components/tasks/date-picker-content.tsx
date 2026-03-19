"use client";

import { useState, useRef, useCallback } from "react";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Clock, X } from "lucide-react";
import { addDays, startOfDay, nextMonday, format, parseISO } from "date-fns";
import type { Locale as DateFnsLocale } from "date-fns";
import { parseTimeInput } from "@/lib/parse-time";

function TimeInput({
  value,
  onChange,
  onRemove,
  removeTitle,
}: {
  value: string;
  onChange: (time: string) => void;
  onRemove: () => void;
  removeTitle: string;
}) {
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = useCallback(() => {
    const parsed = parseTimeInput(draft);
    if (parsed) {
      onChange(parsed);
      setDraft(parsed);
    } else {
      // Revert to last valid value
      setDraft(value);
    }
  }, [draft, onChange, value]);

  return (
    <>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        placeholder="HH:MM"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
            inputRef.current?.blur();
          }
        }}
        className="text-foreground h-9 w-20 bg-transparent text-sm outline-none md:h-8"
      />
      <button
        onClick={onRemove}
        className="text-muted-foreground hover:text-foreground ml-auto"
        title={removeTitle}
      >
        <X className="h-4 w-4" />
      </button>
    </>
  );
}

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
  // End date support
  endValue?: Date | undefined;
  endHasTime?: boolean;
  endTimeValue?: string;
  onEndDateSelect?: (date: Date | undefined) => void;
  onEndTimeChange?: (time: string) => void;
  onClearEndDate?: () => void;
  onQuickEndDate?: (type: "1h" | "sunday") => void;
  /** The raw dueDate string, needed for "Until Sunday" day-of-week check */
  dueDateStr?: string | null;
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
  endValue,
  endHasTime = false,
  endTimeValue = "",
  onEndDateSelect,
  onEndTimeChange,
  onClearEndDate,
  onQuickEndDate,
  dueDateStr,
}: DatePickerContentProps) {
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);
  const nextWeekDay = nextMonday(today);
  const hasEndDateSupport = !!onEndDateSelect;
  const [showEndPicker, setShowEndPicker] = useState(!!endValue);

  function handlePreset(date: Date) {
    onDateSelect(date);
    if (!hasEndDateSupport) onClose?.();
  }

  function handleCalendarSelect(date: Date | undefined) {
    onDateSelect(date);
  }

  function handleClear() {
    onClear();
    onClose?.();
  }

  const startDayOfWeek = dueDateStr ? parseISO(dueDateStr.split("T")[0]).getDay() : null;
  const showUntilSunday = startDayOfWeek !== null && startDayOfWeek !== 0;

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

      {/* Calendars: start + optional end side by side */}
      <div className="flex flex-col gap-0 md:flex-row md:gap-4">
        {/* Start calendar */}
        <div className="flex flex-col">
          {hasEndDateSupport && (showEndPicker || endValue) && (
            <div className="text-muted-foreground px-3 pt-2 text-xs font-medium">
              {t("datePicker.dueDate")}
            </div>
          )}
          <CalendarComponent
            mode="single"
            locale={dateFnsLocale}
            selected={value}
            onSelect={handleCalendarSelect}
            defaultMonth={value}
          />
          {/* Start date time toggle */}
          {showTimeToggle && (
            <>
              <Separator />
              <div className="flex items-center gap-2 px-3 py-2">
                <Clock className="text-muted-foreground h-4 w-4" />
                {hasTime ? (
                  <TimeInput
                    value={timeValue}
                    onChange={(time) => onTimeChange?.(time)}
                    onRemove={() => onTimeChange?.("")}
                    removeTitle={t("datePicker.removeTime")}
                  />
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
        </div>

        {/* End calendar */}
        {hasEndDateSupport && (showEndPicker || endValue) && (
          <div className="flex flex-col">
            <div className="text-muted-foreground px-3 pt-2 text-xs font-medium">
              {t("datePicker.endDate")}
            </div>
            <CalendarComponent
              mode="single"
              locale={dateFnsLocale}
              selected={endValue}
              onSelect={onEndDateSelect}
              defaultMonth={endValue ?? value}
              disabled={value ? { before: value } : undefined}
            />
            {/* End date time */}
            {showTimeToggle && onEndTimeChange && (
              <>
                <Separator />
                <div className="flex items-center gap-2 px-3 py-2">
                  <Clock className="text-muted-foreground h-4 w-4" />
                  {endHasTime ? (
                    <TimeInput
                      value={endTimeValue}
                      onChange={(time) => onEndTimeChange(time)}
                      onRemove={() => onEndTimeChange("")}
                      removeTitle={t("datePicker.removeTime")}
                    />
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 md:h-8"
                      onClick={() => onEndTimeChange(format(new Date(), "HH:mm"))}
                    >
                      {t("datePicker.addTime")}
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Add end date button + quick buttons */}
      {hasEndDateSupport && !showEndPicker && !endValue && value && (
        <>
          <Separator />
          <div className="flex items-center gap-2 p-3">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground h-9 text-xs md:h-8"
              onClick={() => setShowEndPicker(true)}
            >
              {t("datePicker.addEndDate")}
            </Button>
            {onQuickEndDate && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 text-xs md:h-8"
                  onClick={() => {
                    onQuickEndDate("1h");
                    setShowEndPicker(true);
                  }}
                >
                  {t("datePicker.quickOneHour")}
                </Button>
                {showUntilSunday && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 text-xs md:h-8"
                    onClick={() => {
                      onQuickEndDate("sunday");
                      setShowEndPicker(true);
                    }}
                  >
                    {t("datePicker.quickUntilSunday")}
                  </Button>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* Remove date(s) */}
      {value && (
        <>
          <Separator />
          <div className="flex gap-2 p-3">
            <Button
              variant="ghost"
              size="sm"
              className="h-9 flex-1 text-red-500 hover:text-red-600 md:h-8"
              onClick={handleClear}
            >
              {t("datePicker.removeDate")}
            </Button>
            {endValue && onClearEndDate && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 flex-1 text-red-500 hover:text-red-600 md:h-8"
                onClick={() => {
                  onClearEndDate();
                  setShowEndPicker(false);
                }}
              >
                {t("datePicker.removeEndDate")}
              </Button>
            )}
          </div>
        </>
      )}

      {/* Done button */}
      {onClose && (
        <>
          <Separator />
          <div className="p-3">
            <Button size="sm" className="h-9 w-full md:h-8" onClick={onClose}>
              {t("datePicker.done")}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
