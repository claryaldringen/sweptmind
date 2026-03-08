import DataLoader from "dataloader";
import type { List } from "@/domain/entities/list";
import type { Location } from "@/domain/entities/location";
import type { Step } from "@/domain/entities/task";
import type { Tag } from "@/domain/entities/tag";
import type { Repos } from "@/infrastructure/container";

export interface DataLoaders {
  listById: DataLoader<string, List | undefined>;
  locationById: DataLoader<string, Location | undefined>;
  stepsByTaskId: DataLoader<string, Step[]>;
  tagsByTaskId: DataLoader<string, Tag[]>;
  taskCountByListId: DataLoader<string, number>;
  taskCountByTagId: DataLoader<string, number>;
  visibleTaskCountByListId: DataLoader<string, number>;
  dependentTaskCountByTaskId: DataLoader<string, number>;
}

export function createDataLoaders(repos: Repos, userId: string): DataLoaders {
  return {
    listById: new DataLoader(async (ids) => {
      const lists = await repos.list.findByIds([...ids], userId);
      const map = new Map(lists.map((l) => [l.id, l]));
      return ids.map((id) => map.get(id));
    }),

    locationById: new DataLoader(async (ids) => {
      const locations = await repos.location.findByIds([...ids], userId);
      const map = new Map(locations.map((l) => [l.id, l]));
      return ids.map((id) => map.get(id));
    }),

    stepsByTaskId: new DataLoader(async (taskIds) => {
      const map = await repos.step.findByTaskIds([...taskIds]);
      return taskIds.map((id) => map.get(id) ?? []);
    }),

    tagsByTaskId: new DataLoader(async (taskIds) => {
      const map = await repos.tag.findByTaskIds([...taskIds]);
      return taskIds.map((id) => map.get(id) ?? []);
    }),

    taskCountByTagId: new DataLoader(async (tagIds) => {
      const map = await repos.tag.countTasksByTags([...tagIds]);
      return tagIds.map((id) => map.get(id) ?? 0);
    }),

    taskCountByListId: new DataLoader(async (listIds) => {
      const map = await repos.task.countActiveByListIds([...listIds]);
      return listIds.map((id) => map.get(id) ?? 0);
    }),

    visibleTaskCountByListId: new DataLoader(async (listIds) => {
      const today = new Date().toISOString().slice(0, 10);
      const map = await repos.task.countVisibleByListIds([...listIds], today);
      return listIds.map((id) => map.get(id) ?? 0);
    }),

    dependentTaskCountByTaskId: new DataLoader(async (taskIds) => {
      const counts = await Promise.all(
        [...taskIds].map(async (id) => {
          const deps = await repos.task.findDependentTaskIds(id);
          return deps.length;
        }),
      );
      return taskIds.map((_, i) => counts[i]);
    }),
  };
}
