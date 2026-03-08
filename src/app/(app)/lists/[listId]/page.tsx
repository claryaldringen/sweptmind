"use client";

import { useParams } from "next/navigation";
import { gql } from "@apollo/client";
import { useQuery, useMutation } from "@apollo/client/react";
import {
  ArrowLeft,
  ChevronDown,
  MapPin,
  MoreHorizontal,
  Navigation,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { ListIcon, LIST_ICONS } from "@/lib/list-icons";
import { useSidebarContext } from "@/components/layout/app-shell";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SortableTaskList } from "@/components/tasks/sortable-task-list";
import { TaskInput } from "@/components/tasks/task-input";
import { ResizableTaskLayout } from "@/components/layout/resizable-task-layout";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
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
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import { useTranslations } from "@/lib/i18n";
import { useGeocode } from "@/hooks/use-geocode";
import { useNearby } from "@/components/providers/nearby-provider";
import { cn } from "@/lib/utils";
import { DeviceContextPicker } from "@/components/ui/device-context-picker";
import { RADIUS_OPTIONS } from "@/lib/constants";

const GET_TASKS_BY_LIST = gql`
  query TasksByList($listId: String!) {
    tasksByList(listId: $listId) {
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
        radius
      }
      list {
        id
        name
      }
      blockedByTaskId
      blockedByTaskIsCompleted
      dependentTaskCount
    }
  }
`;

const GET_LIST = gql`
  query GetList($id: String!) {
    list(id: $id) {
      id
      name
      icon
      themeColor
      isDefault
      locationId
      deviceContext
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

const UPDATE_LIST = gql`
  mutation UpdateList($id: String!, $input: UpdateListInput!) {
    updateList(id: $id, input: $input) {
      id
      name
      icon
      locationId
      deviceContext
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

const GET_LOCATIONS = gql`
  query GetLocations {
    locations {
      id
      name
      latitude
      longitude
      radius
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
      radius
      address
    }
  }
`;

const UPDATE_LOCATION = gql`
  mutation UpdateLocation($id: String!, $input: UpdateLocationInput!) {
    updateLocation(id: $id, input: $input) {
      id
      radius
    }
  }
`;

const DELETE_LOCATION = gql`
  mutation DeleteLocation($id: String!) {
    deleteLocation(id: $id)
  }
`;

const DELETE_LIST = gql`
  mutation DeleteList($id: String!) {
    deleteList(id: $id)
  }
`;

interface Step {
  id: string;
  taskId: string;
  title: string;
  isCompleted: boolean;
  sortOrder: number;
}

interface TasksByListTask {
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
  blockedByTaskId: string | null;
  blockedByTaskIsCompleted: boolean | null;
  dependentTaskCount: number;
}

interface TasksByListData {
  tasksByList: TasksByListTask[];
}

interface LocationInfo {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
  address?: string | null;
}

interface ListDetail {
  id: string;
  name: string;
  icon: string | null;
  themeColor: string | null;
  isDefault: boolean;
  locationId: string | null;
  deviceContext: string | null;
  location: LocationInfo | null;
}

interface GetListData {
  list: ListDetail | null;
}

interface UpdateListData {
  updateList: { id: string; name: string };
}

interface DeleteListData {
  deleteList: boolean;
}

export default function ListPage() {
  const { listId } = useParams<{ listId: string }>();
  const router = useRouter();
  const { t, locale: appLocale } = useTranslations();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [iconPopoverOpen, setIconPopoverOpen] = useState(false);
  const [locationPopoverOpen, setLocationPopoverOpen] = useState(false);
  const [locationSearch, setLocationSearch] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [radiusPopoverOpen, setRadiusPopoverOpen] = useState(false);
  const { open: openSidebar, isDesktop } = useSidebarContext();
  const { isNearby: checkNearby, userLatitude, userLongitude } = useNearby();
  const geocode = useGeocode({ userLatitude, userLongitude, locale: appLocale });

  const { data: listData } = useQuery<GetListData>(GET_LIST, {
    variables: { id: listId },
  });
  const { data: tasksData, loading } = useQuery<TasksByListData>(GET_TASKS_BY_LIST, {
    variables: { listId },
  });
  const { data: locationsData } = useQuery<{ locations: LocationInfo[] }>(GET_LOCATIONS);

  const [updateList] = useMutation<UpdateListData>(UPDATE_LIST);

  const [deleteList] = useMutation<DeleteListData>(DELETE_LIST, {
    update(cache, _result, { variables }) {
      if (!variables?.id) return;
      cache.evict({ id: cache.identify({ __typename: "List", id: variables.id }) });
      cache.gc();
    },
  });

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
                  radius
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
  const [updateLocation] = useMutation(UPDATE_LOCATION);

  const list = listData?.list;
  const tasks = tasksData?.tasksByList ?? [];

  function handleRename(e: React.FocusEvent<HTMLInputElement>) {
    const newName = e.target.value.trim();
    if (newName && list && newName !== list.name) {
      updateList({ variables: { id: list.id, input: { name: newName } } });
    } else if (list) {
      e.target.value = list.name;
    }
  }

  async function handleDelete() {
    if (!list || list.isDefault) return;
    await deleteList({ variables: { id: list.id } });
    router.push("/planned");
  }

  async function handleSelectListLocation(locationId: string) {
    if (!list) return;
    await updateList({
      variables: { id: list.id, input: { locationId } },
    });
    setLocationPopoverOpen(false);
    setLocationSearch("");
    geocode.clear();
  }

  async function handleSelectListGeocodingResult(result: {
    display_name: string;
    lat: string;
    lon: string;
  }) {
    if (!list) return;
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
      await updateList({
        variables: { id: list.id, input: { locationId: locationResult.data.createLocation.id } },
      });
    }
    setLocationPopoverOpen(false);
    setLocationSearch("");
    geocode.clear();
  }

  async function handleRemoveListLocation() {
    if (!list) return;
    await updateList({
      variables: { id: list.id, input: { locationId: null } },
    });
  }

  async function handleUseCurrentLocation() {
    if (!list) return;

    async function saveLocation(latitude: number, longitude: number) {
      const result = await geocode.reverseGeocode(latitude, longitude);
      const locationResult = await createLocation({
        variables: {
          input: {
            name: result?.display_name ?? t("locations.myLocation"),
            latitude,
            longitude,
          },
        },
      });
      if (locationResult.data?.createLocation) {
        await updateList({
          variables: { id: list!.id, input: { locationId: locationResult.data.createLocation.id } },
        });
      }
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

  function handleUpdateLocationRadius(id: string, radius: number) {
    updateLocation({ variables: { id, input: { radius } } });
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
            <Popover open={iconPopoverOpen} onOpenChange={setIconPopoverOpen}>
              <PopoverTrigger asChild>
                <button className="hover:bg-accent rounded-md p-1 transition-colors">
                  <ListIcon icon={list?.icon ?? null} className="h-7 w-7 text-blue-500" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-3" align="start">
                <div className="grid grid-cols-8 gap-1.5">
                  {Object.entries(LIST_ICONS).map(([key, Icon]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        if (list) {
                          updateList({
                            variables: { id: list.id, input: { icon: key } },
                          });
                        }
                        setIconPopoverOpen(false);
                      }}
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-md transition-colors",
                        list?.icon === key || (!list?.icon && key === "list")
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-accent text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <Icon className="h-4.5 w-4.5" />
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <Input
              ref={nameInputRef}
              key={list?.id}
              defaultValue={list?.name ?? t("lists.fallbackName")}
              readOnly={list?.isDefault}
              onBlur={handleRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") {
                  e.currentTarget.value = list?.name ?? "";
                  e.currentTarget.blur();
                }
              }}
              className="h-auto rounded-none border-0 bg-transparent p-0 text-2xl leading-tight font-bold shadow-none outline-none focus-visible:ring-0 md:text-2xl"
            />
          </div>
          <div className="flex items-center gap-1">
            {list?.location && (
              <div className="flex items-center gap-1">
                <Badge
                  variant="secondary"
                  className={cn(
                    "gap-1 pr-1",
                    checkNearby(
                      list.location.latitude,
                      list.location.longitude,
                      list.location.radius,
                    )
                      ? "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400"
                      : "",
                  )}
                >
                  <MapPin
                    className={cn(
                      "h-3 w-3",
                      checkNearby(
                        list.location.latitude,
                        list.location.longitude,
                        list.location.radius,
                      ) && "animate-pulse",
                    )}
                  />
                  {list.location.name}
                  <button
                    onClick={handleRemoveListLocation}
                    className="rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
                  >
                    <span className="sr-only">{t("tasks.removeLocation")}</span>×
                  </button>
                </Badge>
                <Popover open={radiusPopoverOpen} onOpenChange={setRadiusPopoverOpen}>
                  <PopoverTrigger asChild>
                    <button className="text-muted-foreground hover:text-foreground flex items-center gap-0.5 text-xs transition-colors">
                      {t("locations.radiusKm", { radius: String(list.location.radius) })}
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-2" align="start">
                    <div className="flex flex-wrap gap-1">
                      {RADIUS_OPTIONS.map((r) => (
                        <button
                          key={r}
                          onClick={() => {
                            handleUpdateLocationRadius(list.location!.id, r);
                            setRadiusPopoverOpen(false);
                          }}
                          className={cn(
                            "rounded-md px-2 py-1 text-xs transition-colors",
                            list.location!.radius === r
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
              </div>
            )}
            <DeviceContextPicker
              value={list?.deviceContext ?? null}
              onChange={(val) => {
                if (!list) return;
                updateList({
                  variables: { id: list.id, input: { deviceContext: val } },
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
                    <CommandGroup>
                      <CommandItem onSelect={handleUseCurrentLocation} disabled={detectingLocation}>
                        <Navigation className="mr-2 h-3 w-3" />
                        {detectingLocation
                          ? t("locations.detectingLocation")
                          : t("locations.myLocation")}
                      </CommandItem>
                    </CommandGroup>
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
                              onSelect={() => handleSelectListLocation(loc.id)}
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
                        {geocode.results.map((result, i) => (
                          <CommandItem
                            key={i}
                            onSelect={() => handleSelectListGeocodingResult(result)}
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
            {list && !list.isDefault && (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        nameInputRef.current?.focus();
                        nameInputRef.current?.select();
                      }}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      {t("lists.rename")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setDeleteDialogOpen(true)}
                      className="text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {t("lists.delete")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("common.deleteConfirmTitle")}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t("lists.deleteConfirmDesc")}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("common.deleteConfirmCancel")}</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={handleDelete}
                      >
                        {t("common.deleteConfirmAction")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-muted-foreground animate-pulse">{t("common.loading")}</div>
          </div>
        ) : (
          <SortableTaskList tasks={tasks} />
        )}

        <TaskInput listId={listId} />
      </div>
    </ResizableTaskLayout>
  );
}
