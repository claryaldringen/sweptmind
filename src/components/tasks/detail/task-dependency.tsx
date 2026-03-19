"use client";

import { useState } from "react";
import { Link2, Lock, X } from "lucide-react";
import { gql } from "@apollo/client";
import { useLazyQuery, useApolloClient } from "@apollo/client/react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTranslations } from "@/lib/i18n";

const SEARCH_TASKS = gql`
  query SearchTasks($query: String!, $tagIds: [String!]) {
    searchTasks(query: $query, tagIds: $tagIds) {
      id
      title
      list {
        id
        name
      }
    }
  }
`;

interface SearchResult {
  id: string;
  title: string;
  list: { id: string; name: string } | null;
}

interface TaskDependencyProps {
  taskId: string;
  blockedByTask: { id: string; title: string } | null;
  tagIds: string[];
  onSetDependency: (blockedByTaskId: string | null) => void;
  onNavigateToTask: (taskId: string) => void;
}

export function TaskDependency({
  taskId,
  blockedByTask,
  tagIds,
  onSetDependency,
  onNavigateToTask,
}: TaskDependencyProps) {
  const { t } = useTranslations();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const apolloClient = useApolloClient();

  const [searchTasks, { data: searchData, loading: searchLoading }] = useLazyQuery<{
    searchTasks: SearchResult[];
  }>(SEARCH_TASKS, {
    fetchPolicy: "network-only",
  });

  function handleSearch(query: string) {
    setSearchQuery(query);
    if (query.trim().length >= 1) {
      searchTasks({ variables: { query: query.trim(), tagIds } });
    }
  }

  function handleSearchOffline(query: string): SearchResult[] {
    if (query.trim().length < 1) return [];
    const cache = apolloClient.cache.extract() as Record<
      string,
      Record<string, unknown> | undefined
    >;
    const results: SearchResult[] = [];
    const lowerQuery = query.toLowerCase();
    for (const key in cache) {
      const obj = cache[key];
      if (
        obj?.__typename === "Task" &&
        typeof obj.title === "string" &&
        obj.isCompleted === false &&
        obj.id !== taskId &&
        obj.title.toLowerCase().includes(lowerQuery)
      ) {
        results.push({
          id: obj.id as string,
          title: obj.title,
          list: null,
        });
      }
    }
    return results.slice(0, 20);
  }

  const onlineResults = searchData?.searchTasks ?? [];
  const offlineResults = handleSearchOffline(searchQuery);
  const results = onlineResults.length > 0 ? onlineResults : offlineResults;
  const filteredResults = results.filter((r) => r.id !== taskId);

  if (blockedByTask) {
    return (
      <div className="flex items-center">
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-amber-600 dark:text-amber-400"
          onClick={() => onNavigateToTask(blockedByTask.id)}
        >
          <Lock className="h-4 w-4" />
          <span className="truncate">
            {t("dependency.dependsOn")}: {blockedByTask.title}
          </span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => onSetDependency(null)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="w-full justify-start gap-2">
          <Link2 className="h-4 w-4" />
          {t("dependency.addDependency")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t("dependency.searchPlaceholder")}
            value={searchQuery}
            onValueChange={handleSearch}
          />
          <CommandList>
            <CommandEmpty>
              {searchLoading
                ? "..."
                : searchQuery.length < 1
                  ? t("dependency.searchPlaceholder")
                  : "—"}
            </CommandEmpty>
            {filteredResults.length > 0 && (
              <CommandGroup>
                {filteredResults.map((result) => (
                  <CommandItem
                    key={result.id}
                    value={result.id}
                    onSelect={() => {
                      onSetDependency(result.id);
                      setOpen(false);
                      setSearchQuery("");
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{result.title}</span>
                      {result.list && (
                        <span className="text-muted-foreground text-xs">{result.list.name}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
