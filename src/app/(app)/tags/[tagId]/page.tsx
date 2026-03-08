"use client";

import { useRef, useState } from "react";
import { useParams } from "next/navigation";
import { gql } from "@apollo/client";
import { useQuery, useMutation } from "@apollo/client/react";
import { ArrowLeft, MapPin, Tag, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getTagColorClasses } from "@/lib/tag-colors";
import { useSidebarContext } from "@/components/layout/app-shell";
import { TaskList } from "@/components/tasks/task-list";
import { ResizableTaskLayout } from "@/components/layout/resizable-task-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useTranslations } from "@/lib/i18n";
import { DeviceContextPicker } from "@/components/ui/device-context-picker";
import { useGeocode } from "@/hooks/use-geocode";
import { useNearby } from "@/components/providers/nearby-provider";

interface LocationInfo {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address?: string | null;
}

interface TagDetail {
  id: string;
  name: string;
  color: string;
  deviceContext: string | null;
  locationId: string | null;
  location: LocationInfo | null;
}

const GET_TAGS = gql`
  query GetTags {
    tags {
      id
      name
      color
      deviceContext
      locationId
      location {
        id
        name
        latitude
        longitude
      }
    }
  }
`;

const UPDATE_TAG = gql`
  mutation UpdateTag($id: String!, $input: UpdateTagInput!) {
    updateTag(id: $id, input: $input) {
      id
      name
      deviceContext
      locationId
      location {
        id
        name
        latitude
        longitude
      }
    }
  }
`;

const GET_LOCATIONS = gql`
  query GetLocations {
    locations {
      id
      name
      latitude
      longitude
      address
    }
  }
`;

const CREATE_LOCATION = gql`
  mutation CreateLocation($input: CreateLocationInput!) {
    createLocation(input: $input) {
      id
      name
      latitude
      longitude
      address
    }
  }
`;

const DELETE_LOCATION = gql`
  mutation DeleteLocation($id: String!) {
    deleteLocation(id: $id)
  }
`;

const TASKS_BY_TAG = gql`
  query TasksByTag($tagId: String!) {
    tasksByTag(tagId: $tagId) {
      id
      listId
      locationId
      title
      notes
      isCompleted
      completedAt
      dueDate
      reminderAt
      recurrence
      deviceContext
      sortOrder
      createdAt
      steps {
        id
        taskId
        title
        isCompleted
        sortOrder
      }
      tags {
        id
        name
        color
      }
      location {
        id
        name
        latitude
        longitude
      }
      list {
        id
        name
      }
    }
  }
`;

interface Step {
  id: string;
  taskId: string;
  title: string;
  isCompleted: boolean;
  sortOrder: number;
}

interface TaskTag {
  id: string;
  name: string;
  color: string;
}

interface TagTask {
  id: string;
  listId: string;
  title: string;
  notes: string | null;
  isCompleted: boolean;
  dueDate: string | null;
  reminderAt: string | null;
  sortOrder: number;
  createdAt: string;
  steps: Step[];
  tags: TaskTag[];
  list: { id: string; name: string } | null;
}

interface TasksByTagData {
  tasksByTag: TagTask[];
}

interface GetTagsData {
  tags: TagDetail[];
}

export default function TagPage() {
  const { tagId } = useParams<{ tagId: string }>();
  const { t, locale: appLocale } = useTranslations();
  const { open: openSidebar, isDesktop } = useSidebarContext();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [locationPopoverOpen, setLocationPopoverOpen] = useState(false);
  const [locationSearch, setLocationSearch] = useState("");
  const { isNearby: checkNearby, userLatitude, userLongitude } = useNearby();
  const geocode = useGeocode({ userLatitude, userLongitude, locale: appLocale });

  const { data: tagsData } = useQuery<GetTagsData>(GET_TAGS);
  const { data, loading } = useQuery<TasksByTagData>(TASKS_BY_TAG, {
    variables: { tagId },
  });
  const { data: locationsData } = useQuery<{ locations: LocationInfo[] }>(GET_LOCATIONS);

  const [updateTag] = useMutation(UPDATE_TAG);
  const [createLocation] = useMutation<{ createLocation: LocationInfo }>(CREATE_LOCATION, {
    update(cache, { data }) {
      if (!data?.createLocation) return;
      cache.modify({
        fields: {
          locations(existing = []) {
            const newRef = cache.writeFragment({
              data: data.createLocation,
              fragment: gql`
                fragment NewLocation on Location {
                  id
                  name
                  latitude
                  longitude
                  address
                }
              `,
            });
            return [...existing, newRef];
          },
        },
      });
    },
  });
  const [deleteLocation] = useMutation<{ deleteLocation: boolean }>(DELETE_LOCATION, {
    update(cache, _result, { variables }) {
      if (!variables?.id) return;
      cache.evict({ id: cache.identify({ __typename: "Location", id: variables.id }) });
      cache.gc();
    },
  });

  const tag = tagsData?.tags?.find((t) => t.id === tagId);
  const tasks = data?.tasksByTag ?? [];
  const colors = tag ? getTagColorClasses(tag.color) : getTagColorClasses("blue");

  function handleRename(e: React.FocusEvent<HTMLInputElement>) {
    const newName = e.target.value.trim();
    if (newName && tag && newName !== tag.name) {
      updateTag({ variables: { id: tag.id, input: { name: newName } } });
    } else if (tag) {
      e.target.value = tag.name;
    }
  }

  async function handleSelectLocation(locationId: string) {
    if (!tag) return;
    await updateTag({
      variables: { id: tag.id, input: { locationId } },
    });
    setLocationPopoverOpen(false);
    setLocationSearch("");
    geocode.clear();
  }

  async function handleSelectGeocodingResult(result: {
    display_name: string;
    lat: string;
    lon: string;
  }) {
    if (!tag) return;
    const locationResult = await createLocation({
      variables: {
        input: {
          name: result.display_name.split(",")[0],
          latitude: parseFloat(result.lat),
          longitude: parseFloat(result.lon),
          address: result.display_name,
        },
      },
    });
    if (locationResult.data?.createLocation) {
      await updateTag({
        variables: { id: tag.id, input: { locationId: locationResult.data.createLocation.id } },
      });
    }
    setLocationPopoverOpen(false);
    setLocationSearch("");
    geocode.clear();
  }

  async function handleRemoveLocation() {
    if (!tag) return;
    await updateTag({
      variables: { id: tag.id, input: { locationId: null } },
    });
  }

  return (
    <ResizableTaskLayout>
      <div className="flex flex-1 flex-col h-full">
        <div className="flex items-center justify-between px-6 pt-8 pb-4">
          <div className="flex items-center gap-2">
            {!isDesktop && (
              <Button variant="ghost" size="icon" onClick={openSidebar} className="-ml-2">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <Tag className={cn("h-7 w-7", colors.text)} />
            <Input
              ref={nameInputRef}
              key={tag?.id}
              defaultValue={tag?.name ?? t("pages.tag")}
              onBlur={handleRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") {
                  e.currentTarget.value = tag?.name ?? "";
                  e.currentTarget.blur();
                }
              }}
              className="h-auto rounded-none border-0 bg-transparent p-0 text-2xl leading-tight font-bold shadow-none outline-none focus-visible:ring-0 md:text-2xl"
            />
          </div>
          <div className="flex items-center gap-1">
            {tag?.location && (
              <Badge
                variant="secondary"
                className={cn(
                  "gap-1 pr-1",
                  checkNearby(tag.location.latitude, tag.location.longitude)
                    ? "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400"
                    : "",
                )}
              >
                <MapPin
                  className={cn(
                    "h-3 w-3",
                    tag.location &&
                      checkNearby(tag.location.latitude, tag.location.longitude) &&
                      "animate-pulse",
                  )}
                />
                {tag.location.name}
                <button
                  onClick={handleRemoveLocation}
                  className="rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
                >
                  <span className="sr-only">{t("tasks.removeLocation")}</span>×
                </button>
              </Badge>
            )}
            <DeviceContextPicker
              value={tag?.deviceContext ?? null}
              onChange={(val) => {
                if (!tag) return;
                updateTag({
                  variables: { id: tag.id, input: { deviceContext: val } },
                });
              }}
            />
            <Popover
              open={locationPopoverOpen}
              onOpenChange={(open) => {
                setLocationPopoverOpen(open);
                if (!open) {
                  setLocationSearch("");
                  geocode.clear();
                }
              }}
            >
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MapPin className="h-5 w-5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0" align="end">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder={t("tasks.searchLocation")}
                    value={locationSearch}
                    onValueChange={(val) => {
                      setLocationSearch(val);
                      geocode.search(val);
                    }}
                  />
                  <CommandList>
                    <CommandEmpty />
                    {(locationsData?.locations ?? []).filter(
                      (loc) =>
                        !locationSearch ||
                        loc.name.toLowerCase().includes(locationSearch.toLowerCase()),
                    ).length > 0 && (
                      <CommandGroup heading={t("tasks.savedLocations")}>
                        {(locationsData?.locations ?? [])
                          .filter(
                            (loc) =>
                              !locationSearch ||
                              loc.name.toLowerCase().includes(locationSearch.toLowerCase()),
                          )
                          .map((loc) => (
                            <CommandItem
                              key={loc.id}
                              onSelect={() => handleSelectLocation(loc.id)}
                              className="group/loc"
                            >
                              <MapPin className="mr-2 h-3 w-3" />
                              <span className="flex-1 truncate">{loc.name}</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteLocation({ variables: { id: loc.id } });
                                }}
                                className="rounded-full p-0.5 opacity-0 transition-opacity group-hover/loc:opacity-100 hover:bg-black/10 dark:hover:bg-white/10"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </CommandItem>
                          ))}
                      </CommandGroup>
                    )}
                    {geocode.results.length > 0 && (
                      <CommandGroup heading={t("tasks.searchResults")}>
                        {geocode.results.map((result) => (
                          <CommandItem
                            key={`${result.lat}-${result.lon}`}
                            onSelect={() => handleSelectGeocodingResult(result)}
                          >
                            <MapPin className="mr-2 h-3 w-3" />
                            <span className="truncate">{result.display_name}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>
        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-muted-foreground animate-pulse">{t("common.loading")}</div>
          </div>
        ) : (
          <TaskList tasks={tasks} showListName />
        )}
      </div>
    </ResizableTaskLayout>
  );
}
