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
}: TaskRecurrenceProps) {
  const [recurrenceOpen, setRecurrenceOpen] = useState(false);

  function handleSetRecurrence(value: string | null) {
    onSetRecurrence(value);
    if (value === null) setRecurrenceOpen(false);
  }

  const recurrenceTypes = [
    { type: "DAILY" as const, label: dailyLabel },
    { type: "WEEKLY" as const, label: weeklyLabel },
    { type: "MONTHLY" as const, label: monthlyLabel },
    { type: "MONTHLY_LAST" as const, label: monthlyLastLabel },
    { type: "YEARLY" as const, label: yearlyLabel },
  ];

  return (
    <Popover open={recurrenceOpen} onOpenChange={setRecurrenceOpen}>
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
        <div className="space-y-1">
          {recurrenceTypes.map(({ type, label }) => (
            <Button
              key={type}
              variant="ghost"
              size="sm"
              className={cn(
                "w-full justify-start",
                recurrence === type && "bg-accent",
                type === "WEEKLY" && recurrence?.startsWith("WEEKLY:") && "bg-accent",
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

        {recurrence?.startsWith("WEEKLY:") && (
          <>
            <Separator />
            <div className="flex gap-1">
              {daysShort.map((dayName, index) => {
                const isActive = recurrence.slice(7).split(",").map(Number).includes(index);
                return (
                  <Button
                    key={index}
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    className="h-8 w-8 p-0 text-xs"
                    onClick={() => onToggleWeeklyDay(index)}
                  >
                    {dayName}
                  </Button>
                );
              })}
            </div>
          </>
        )}

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
      </PopoverContent>
    </Popover>
  );
}
