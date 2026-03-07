"use client";

import { Smartphone, Monitor, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n";

interface DeviceContextPickerProps {
  value: string | null;
  onChange: (value: string | null) => void;
}

export function DeviceContextPicker({ value, onChange }: DeviceContextPickerProps) {
  const { t } = useTranslations();

  if (value) {
    return (
      <Badge variant="secondary" className="gap-1 pr-1">
        {value === "phone" ? <Smartphone className="h-3 w-3" /> : <Monitor className="h-3 w-3" />}
        {value === "phone" ? t("context.phone") : t("context.computer")}
        <button
          onClick={() => onChange(null)}
          className="rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
        >
          <X className="h-3 w-3" />
        </button>
      </Badge>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
          <Monitor className="h-3.5 w-3.5" />
          {t("context.deviceContext")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onChange("phone")}>
          <Smartphone className="mr-2 h-4 w-4" />
          {t("context.phone")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onChange("computer")}>
          <Monitor className="mr-2 h-4 w-4" />
          {t("context.computer")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
