"use client";

import { useState } from "react";
import { X, MapPin, Navigation, ChevronDown } from "lucide-react";
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
  CommandSeparator,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n";
import { useGeocode } from "@/hooks/use-geocode";
import { useNearby } from "@/components/providers/nearby-provider";
import type { TaskLocation as TaskLocationType } from "./types";
import { RADIUS_OPTIONS } from "@/lib/constants";

interface GeocodingResult {
  display_name: string;
  lat: string;
  lon: string;
}

interface TaskLocationProps {
  location: TaskLocationType | null;
  savedLocations: TaskLocationType[];
  onSelectLocation: (locationId: string) => Promise<void>;
  onCreateLocation: (loc: {
    name: string;
    latitude: number;
    longitude: number;
    radius?: number;
    address?: string | null;
  }) => Promise<void>;
  onRemoveLocation: () => Promise<void>;
  onDeleteSavedLocation: (id: string) => void;
  onUpdateLocationRadius?: (id: string, radius: number) => void;
}

export function TaskLocation({
  location,
  savedLocations,
  onSelectLocation,
  onCreateLocation,
  onRemoveLocation,
  onDeleteSavedLocation,
  onUpdateLocationRadius,
}: TaskLocationProps) {
  const { t, locale } = useTranslations();
  const { isNearby: checkNearby, userLatitude, userLongitude } = useNearby();
  const geocode = useGeocode({ userLatitude, userLongitude, locale });
  const [locationPopoverOpen, setLocationPopoverOpen] = useState(false);
  const [locationSearch, setLocationSearch] = useState("");
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [radiusPopoverOpen, setRadiusPopoverOpen] = useState(false);

  async function handleSelectLocation(locationId: string) {
    await onSelectLocation(locationId);
    setLocationPopoverOpen(false);
    setLocationSearch("");
    geocode.clear();
  }

  async function handleSelectGeocodingResult(result: GeocodingResult) {
    await onCreateLocation({
      name: result.display_name.split(",")[0],
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
      address: result.display_name,
    });
    setLocationPopoverOpen(false);
    setLocationSearch("");
    geocode.clear();
  }

  async function handleUseCurrentLocation() {
    async function saveLocation(latitude: number, longitude: number) {
      const result = await geocode.reverseGeocode(latitude, longitude);
      await onCreateLocation({
        name: result?.display_name ?? t("locations.myLocation"),
        latitude,
        longitude,
      });
      setDetectingLocation(false);
      setLocationPopoverOpen(false);
    }

    // Use already-known position if available
    if (userLatitude != null && userLongitude != null) {
      setDetectingLocation(true);
      await saveLocation(userLatitude, userLongitude);
      return;
    }

    // Fallback to getCurrentPosition
    if (!("geolocation" in navigator)) return;
    setDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => saveLocation(pos.coords.latitude, pos.coords.longitude),
      () => setDetectingLocation(false),
      { timeout: 5000 },
    );
  }

  const filteredSaved = savedLocations.filter(
    (loc) => !locationSearch || loc.name.toLowerCase().includes(locationSearch.toLowerCase()),
  );

  return (
    <div className="space-y-2">
      {location && (
        <div className="flex items-center gap-1">
          <Badge
            variant="secondary"
            className={cn(
              "gap-1 pr-1",
              checkNearby(location.latitude, location.longitude, location.radius)
                ? "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400"
                : "",
            )}
          >
            <MapPin
              className={cn(
                "h-3 w-3",
                checkNearby(location.latitude, location.longitude, location.radius) &&
                  "animate-pulse",
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
          {onUpdateLocationRadius && (
            <Popover open={radiusPopoverOpen} onOpenChange={setRadiusPopoverOpen}>
              <PopoverTrigger asChild>
                <button className="text-muted-foreground hover:text-foreground flex items-center gap-0.5 text-xs transition-colors">
                  {t("locations.radiusKm", { radius: String(location.radius) })}
                  <ChevronDown className="h-3 w-3" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2" align="start">
                <div className="flex flex-wrap gap-1">
                  {RADIUS_OPTIONS.map((r) => (
                    <button
                      key={r}
                      onClick={() => {
                        onUpdateLocationRadius(location.id, r);
                        setRadiusPopoverOpen(false);
                      }}
                      className={cn(
                        "rounded-md px-2 py-1 text-xs transition-colors",
                        location.radius === r
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-accent text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {t("locations.radiusKm", { radius: String(r) })}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      )}
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
          <Button variant="ghost" className="w-full justify-start gap-2">
            <MapPin className="h-4 w-4" />
            {t("tasks.addLocation")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
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
              <CommandGroup>
                <CommandItem onSelect={handleUseCurrentLocation} disabled={detectingLocation}>
                  <Navigation className="mr-2 h-3 w-3" />
                  {detectingLocation
                    ? t("locations.detectingLocation")
                    : t("locations.myLocation")}
                </CommandItem>
              </CommandGroup>
              {filteredSaved.length > 0 && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading={t("tasks.savedLocations")}>
                    {filteredSaved.map((loc) => (
                      <CommandItem
                        key={loc.id}
                        onSelect={() => handleSelectLocation(loc.id)}
                        className="group/loc"
                      >
                        <MapPin className="mr-2 h-3 w-3" />
                        <span className="flex-1 truncate">{loc.name}</span>
                        <span className="text-muted-foreground text-xs">
                          {t("locations.radiusKm", { radius: String(loc.radius) })}
                        </span>
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
                </>
              )}
              {geocode.results.length > 0 && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading={t("tasks.searchResults")}>
                    {geocode.results.map((result, i) => (
                      <CommandItem key={i} onSelect={() => handleSelectGeocodingResult(result)}>
                        <MapPin className="mr-2 h-3 w-3" />
                        <span className="truncate">{result.display_name}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
