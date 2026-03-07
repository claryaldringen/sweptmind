"use client";

import { useState } from "react";
import { X, MapPin } from "lucide-react";
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
import type { TaskLocation as TaskLocationType } from "./types";

interface GeocodingResult {
  display_name: string;
  lat: string;
  lon: string;
}

interface TaskLocationProps {
  location: TaskLocationType | null;
  savedLocations: TaskLocationType[];
  geocodeResults: GeocodingResult[];
  onSearch: (query: string) => void;
  onClearSearch: () => void;
  onSelectLocation: (locationId: string) => Promise<void>;
  onSelectGeocodingResult: (result: GeocodingResult) => Promise<void>;
  onRemoveLocation: () => Promise<void>;
  onDeleteSavedLocation: (id: string) => void;
  checkNearby: (lat: number, lon: number) => boolean;
  addLocationLabel: string;
  searchLocationLabel: string;
  savedLocationsLabel: string;
  searchResultsLabel: string;
}

export function TaskLocation({
  location,
  savedLocations,
  geocodeResults,
  onSearch,
  onClearSearch,
  onSelectLocation,
  onSelectGeocodingResult,
  onRemoveLocation,
  onDeleteSavedLocation,
  checkNearby,
  addLocationLabel,
  searchLocationLabel,
  savedLocationsLabel,
  searchResultsLabel,
}: TaskLocationProps) {
  const [locationPopoverOpen, setLocationPopoverOpen] = useState(false);
  const [locationSearch, setLocationSearch] = useState("");

  async function handleSelectLocation(locationId: string) {
    await onSelectLocation(locationId);
    setLocationPopoverOpen(false);
    setLocationSearch("");
    onClearSearch();
  }

  async function handleSelectGeocodingResult(result: GeocodingResult) {
    await onSelectGeocodingResult(result);
    setLocationPopoverOpen(false);
    setLocationSearch("");
    onClearSearch();
  }

  return (
    <div className="space-y-2">
      {location && (
        <div className="flex items-center gap-1">
          <Badge
            variant="secondary"
            className={cn(
              "gap-1 pr-1",
              checkNearby(location.latitude, location.longitude)
                ? "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400"
                : "",
            )}
          >
            <MapPin
              className={cn(
                "h-3 w-3",
                checkNearby(location.latitude, location.longitude) && "animate-pulse",
              )}
            />
            {location.name}
            <button
              onClick={onRemoveLocation}
              className="rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        </div>
      )}
      <Popover
        open={locationPopoverOpen}
        onOpenChange={(open) => {
          setLocationPopoverOpen(open);
          if (!open) {
            setLocationSearch("");
            onClearSearch();
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button variant="ghost" className="w-full justify-start gap-2">
            <MapPin className="h-4 w-4" />
            {addLocationLabel}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={searchLocationLabel}
              value={locationSearch}
              onValueChange={(val) => {
                setLocationSearch(val);
                onSearch(val);
              }}
            />
            <CommandList>
              <CommandEmpty />
              {savedLocations.filter(
                (loc) =>
                  !locationSearch || loc.name.toLowerCase().includes(locationSearch.toLowerCase()),
              ).length > 0 && (
                <CommandGroup heading={savedLocationsLabel}>
                  {savedLocations
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
                            onDeleteSavedLocation(loc.id);
                          }}
                          className="rounded-full p-0.5 opacity-0 transition-opacity group-hover/loc:opacity-100 hover:bg-black/10 dark:hover:bg-white/10"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </CommandItem>
                    ))}
                </CommandGroup>
              )}
              {geocodeResults.length > 0 && (
                <CommandGroup heading={searchResultsLabel}>
                  {geocodeResults.map((result, i) => (
                    <CommandItem key={i} onSelect={() => handleSelectGeocodingResult(result)}>
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
  );
}
