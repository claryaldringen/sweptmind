"use client";

import { useState } from "react";
import { X, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { getTagColorClasses } from "@/lib/tag-colors";
import type { TaskTag as TaskTagType } from "./types";

interface TaskTagsProps {
  taskTags: TaskTagType[];
  allTags: TaskTagType[];
  onAddTag: (tagId: string) => Promise<void>;
  onRemoveTag: (tagId: string) => Promise<void>;
  onCreateAndAddTag: (name: string) => Promise<void>;
  addTagLabel: string;
  searchOrCreateTagLabel: string;
  createTagLabel: (name: string) => string;
}

export function TaskTags({
  taskTags,
  allTags,
  onAddTag,
  onRemoveTag,
  onCreateAndAddTag,
  addTagLabel,
  searchOrCreateTagLabel,
  createTagLabel,
}: TaskTagsProps) {
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");

  async function handleAddTag(tagId: string) {
    await onAddTag(tagId);
    setTagPopoverOpen(false);
  }

  async function handleCreateAndAddTag() {
    if (!newTagName.trim()) return;
    await onCreateAndAddTag(newTagName.trim());
    setNewTagName("");
    setTagPopoverOpen(false);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {taskTags.map((tag) => {
          const colors = getTagColorClasses(tag.color);
          return (
            <Badge
              key={tag.id}
              variant="secondary"
              className={cn("gap-1 pr-1", colors.bg, colors.text)}
            >
              {tag.name}
              <button
                onClick={() => onRemoveTag(tag.id)}
                className="rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          );
        })}
      </div>
      <Popover open={tagPopoverOpen} onOpenChange={setTagPopoverOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" className="w-full justify-start gap-2">
            <Tag className="h-4 w-4" />
            {addTagLabel}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <Command>
            <CommandInput
              placeholder={searchOrCreateTagLabel}
              value={newTagName}
              onValueChange={setNewTagName}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const trimmed = newTagName.trim();
                  if (!trimmed) return;
                  const existingMatch = allTags.find(
                    (tg) =>
                      tg.name.toLowerCase() === trimmed.toLowerCase() &&
                      !taskTags.some((tt) => tt.id === tg.id),
                  );
                  if (existingMatch) {
                    handleAddTag(existingMatch.id);
                  } else if (
                    !allTags.some((tg) => tg.name.toLowerCase() === trimmed.toLowerCase())
                  ) {
                    handleCreateAndAddTag();
                  }
                  e.preventDefault();
                }
              }}
            />
            <CommandList>
              <CommandEmpty>
                {newTagName.trim() && (
                  <button
                    onClick={handleCreateAndAddTag}
                    className="text-primary cursor-pointer text-sm"
                  >
                    {createTagLabel(newTagName.trim())}
                  </button>
                )}
              </CommandEmpty>
              <CommandGroup>
                {allTags
                  .filter((tg) => !taskTags.some((tt) => tt.id === tg.id))
                  .map((tag) => {
                    const colors = getTagColorClasses(tag.color);
                    return (
                      <CommandItem key={tag.id} onSelect={() => handleAddTag(tag.id)}>
                        <span className={cn("h-3 w-3 rounded-full", colors.bg)} />
                        {tag.name}
                      </CommandItem>
                    );
                  })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
