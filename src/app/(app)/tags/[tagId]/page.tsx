"use client";

import { useRef, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { gql } from "@apollo/client";
import { useMutation } from "@apollo/client/react";
import { ArrowLeft, MapPin, Tag, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getTagColorClasses, TAG_COLORS } from "@/lib/tag-colors";
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
import { useAppData } from "@/components/providers/app-data-provider";

const UPDATE_TAG = gql`
  mutation UpdateTag($id: String!, $input: UpdateTagInput!) {
    updateTag(id: $id, input: $input) {
      id
      name
      color
      deviceContext
      locationId
      locationRadius
      location {
        id
        name
        latitude
        longitude
        radius
      }
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

export default function TagPage() {
  const { tagId } = useParams<{ tagId: string }>();
  const { t, locale: appLocale } = useTranslations();
  const { open: openSidebar, isDesktop } = useSidebarContext();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [locationPopoverOpen, setLocationPopoverOpen] = useState(false);
  const [locationSearch, setLocationSearch] = useState("");
  const { isNearby: checkNearby, userLatitude, userLongitude } = useNearby();
  const geocode = useGeocode({ userLatitude, userLongitude, locale: appLocale });
  const { tags, allTasks, locations: allLocations, loading } = useAppData();

  const [updateTag] = useMutation(UPDATE_TAG);
  const [createLocation] = useMutation<{
    createLocation: { id: string; name: string; latitude: number; longitude: number };
  }>(CREATE_LOCATION, {
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

  const tag = tags.find((t) => t.id === tagId);
  const tasks = useMemo(
    () => allTasks.filter((task) => task.tags?.some((t) => t.id === tagId)),
    [allTasks, tagId],
  );
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
      <div className="flex h-full flex-1 flex-col">
        <div className="flex items-center justify-between px-6 pt-8 pb-4">
          <div className="flex items-center gap-2">
            {!isDesktop && (
              <Button variant="ghost" size="icon" onClick={openSidebar} className="-ml-2">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <Popover>
              <PopoverTrigger asChild>
                <button className="group relative flex-shrink-0">
                  <Tag className={cn("h-7 w-7", colors.text)} />
                  <span
                    className={cn(
                      "absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 border-white dark:border-gray-950",
                      colors.bg,
                    )}
                  />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2" align="start">
                <div className="grid grid-cols-4 gap-1.5">
                  {Object.entries(TAG_COLORS).map(([key, c]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        if (tag && key !== tag.color) {
                          updateTag({ variables: { id: tag.id, input: { color: key } } });
                        }
                      }}
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full transition-transform hover:scale-110",
                        c.bg,
                        tag?.color === key && "ring-2 ring-current ring-offset-2",
                      )}
                    >
                      <span className={cn("h-4 w-4 rounded-full", c.bg)} />
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
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
                  checkNearby(
                    tag.location.latitude,
                    tag.location.longitude,
                    tag.locationRadius ?? tag.location.radius,
                  )
                    ? "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400"
                    : "",
                )}
              >
                <MapPin
                  className={cn(
                    "h-3 w-3",
                    tag.location &&
                      checkNearby(
                        tag.location.latitude,
                        tag.location.longitude,
                        tag.locationRadius ?? tag.location.radius,
                      ) &&
                      "animate-pulse",
                  )}
                />
                {tag.location.name}
                <button
                  onClick={handleRemoveLocation}
                  className="rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
                >
                  <span className="sr-only">{t("tasks.removeLocation")}</span>
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
                    {allLocations.filter(
                      (loc) =>
                        !locationSearch ||
                        loc.name.toLowerCase().includes(locationSearch.toLowerCase()),
                    ).length > 0 && (
                      <CommandGroup heading={t("tasks.savedLocations")}>
                        {allLocations
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
