"use client";

import { useState } from "react";
import { Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface TaskRecurrenceProps {
  recurrence: string | null;
  onSetRecurrence: (value: string | null) => void;
  onToggleWeeklyDay: (day: number) => void;
  formatRecurrence: (recurrence: string | null) => string | null;
  daysShort: string[];
  addRecurrenceLabel: string;
  dailyLabel: string;
  weeklyLabel: string;
  monthlyLabel: string;
  monthlyLastLabel: string;
  yearlyLabel: string;
  removeRecurrenceLabel: string;
  customLabel: string;
  backLabel: string;
  doneLabel: string;
  everyLabel: string;
  unitLabels: { days: string[]; weeks: string[]; months: string[]; years: string[] };
}

export function TaskRecurrence({
  recurrence,
  onSetRecurrence,
  onToggleWeeklyDay,
  formatRecurrence,
  daysShort,
  addRecurrenceLabel,
  dailyLabel,
  weeklyLabel,
  monthlyLabel,
  monthlyLastLabel,
  yearlyLabel,
  removeRecurrenceLabel,
  customLabel,
  backLabel,
  doneLabel,
  everyLabel,
  unitLabels,
}: TaskRecurrenceProps) {
  const [recurrenceOpen, setRecurrenceOpen] = useState(false);
  const [customView, setCustomView] = useState(false);
  const [customInterval, setCustomInterval] = useState(2);
  const [customUnit, setCustomUnit] = useState<"days" | "weeks" | "months" | "years">("months");
  const [customDays, setCustomDays] = useState<number[]>([]);

  function handleSetRecurrence(value: string | null) {
    onSetRecurrence(value);
    if (!value?.startsWith("WEEKLY:")) setRecurrenceOpen(false);
  }

  function openCustomView() {
    setCustomInterval(2);
    setCustomUnit("months");
    setCustomDays([new Date().getDay()]);
    setCustomView(true);
  }

  function handleCustomDone() {
    let value: string;
    switch (customUnit) {
      case "days":
        value = customInterval === 1 ? "DAILY" : `DAILY:${customInterval}`;
        break;
      case "weeks":
        if (customDays.length === 0) return;
        value =
          customInterval === 1
            ? `WEEKLY:${customDays.join(",")}`
            : `WEEKLY:${customInterval}:${customDays.join(",")}`;
        break;
      case "months":
        value = customInterval === 1 ? "MONTHLY" : `MONTHLY:${customInterval}`;
        break;
      case "years":
        value = customInterval === 1 ? "YEARLY" : `YEARLY:${customInterval}`;
        break;
    }
    onSetRecurrence(value);
    setCustomView(false);
    setRecurrenceOpen(false);
  }

  function toggleCustomDay(day: number) {
    setCustomDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b),
    );
  }

  function pluralize(labels: string[], count: number): string {
    if (labels.length === 3) {
      if (count === 1) return labels[0];
      if (count >= 2 && count <= 4) return labels[1];
      return labels[2];
    }
    return count === 1 ? labels[0] : labels[1];
  }

  const recurrenceTypes = [
    { type: "DAILY" as const, label: dailyLabel },
    { type: "WEEKLY" as const, label: weeklyLabel },
    { type: "MONTHLY" as const, label: monthlyLabel },
    { type: "MONTHLY_LAST" as const, label: monthlyLastLabel },
    { type: "YEARLY" as const, label: yearlyLabel },
  ];

  const isWeeklyActive = recurrence?.startsWith("WEEKLY:");

  return (
    <Popover
      open={recurrenceOpen}
      onOpenChange={(open) => {
        setRecurrenceOpen(open);
        if (!open) setCustomView(false);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className={cn("w-full justify-start gap-2", recurrence && "text-blue-500")}
        >
          <Repeat className="h-4 w-4" />
          {recurrence ? formatRecurrence(recurrence) : addRecurrenceLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-2 p-3" align="start">
        {customView ? (
          <div className="space-y-3">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-1"
              onClick={() => setCustomView(false)}
            >
              ← {backLabel}
            </Button>

            <div className="flex items-center gap-2">
              <span className="text-sm">{everyLabel}</span>
              <input
                type="number"
                min={1}
                max={999}
                value={customInterval}
                onChange={(e) => setCustomInterval(Math.max(1, parseInt(e.target.value) || 1))}
                className="border-input bg-background h-8 w-16 rounded-md border px-2 text-center text-sm"
              />
              <select
                value={customUnit}
                onChange={(e) => setCustomUnit(e.target.value as typeof customUnit)}
                className="border-input bg-background h-8 rounded-md border px-2 text-sm"
              >
                <option value="days">{pluralize(unitLabels.days, customInterval)}</option>
                <option value="weeks">{pluralize(unitLabels.weeks, customInterval)}</option>
                <option value="months">{pluralize(unitLabels.months, customInterval)}</option>
                <option value="years">{pluralize(unitLabels.years, customInterval)}</option>
              </select>
            </div>

            {customUnit === "weeks" && (
              <>
                <Separator />
                <div className="flex gap-0.5">
                  {daysShort.map((dayName, index) => (
                    <Button
                      key={index}
                      variant={customDays.includes(index) ? "default" : "outline"}
                      size="sm"
                      className="h-7 w-7 p-0 text-xs"
                      onClick={() => toggleCustomDay(index)}
                    >
                      {dayName}
                    </Button>
                  ))}
                </div>
              </>
            )}

            <Button
              size="sm"
              className="w-full"
              onClick={handleCustomDone}
              disabled={customUnit === "weeks" && customDays.length === 0}
            >
              {doneLabel}
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-1">
              {recurrenceTypes.map(({ type, label }) => (
                <Button
                  key={type}
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "w-full justify-start",
                    recurrence === type && "bg-accent",
                    type === "WEEKLY" && isWeeklyActive && "bg-accent",
                  )}
                  onClick={() => {
                    if (type === "WEEKLY") {
                      const today = new Date().getDay();
                      handleSetRecurrence(`WEEKLY:${today}`);
                    } else {
                      handleSetRecurrence(type);
                    }
                  }}
                >
                  {label}
                </Button>
              ))}
            </div>

            {isWeeklyActive && (
              <>
                <Separator />
                <div className="flex gap-0.5">
                  {daysShort.map((dayName, index) => {
                    const parts = recurrence!.split(":");
                    const daysStr = parts.length === 3 ? parts[2] : parts[1];
                    const isActive = daysStr.split(",").map(Number).includes(index);
                    return (
                      <Button
                        key={index}
                        variant={isActive ? "default" : "outline"}
                        size="sm"
                        className="h-7 w-7 p-0 text-xs"
                        onClick={() => onToggleWeeklyDay(index)}
                      >
                        {dayName}
                      </Button>
                    );
                  })}
                </div>
              </>
            )}

            <Separator />

            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={openCustomView}
            >
              {customLabel}
            </Button>

            {recurrence && (
              <>
                <Separator />
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive w-full justify-start"
                  onClick={() => handleSetRecurrence(null)}
                >
                  {removeRecurrenceLabel}
                </Button>
              </>
            )}
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
