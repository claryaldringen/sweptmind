import { auth } from "@/lib/auth";
import { services, repos, type Services } from "@/infrastructure/container";
import { createDataLoaders, type DataLoaders } from "./dataloaders";

export interface GraphQLContext {
  services: Services;
  loaders: DataLoaders;
  userId: string | null;
}

export async function createContext(): Promise<GraphQLContext> {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  return {
    services,
    loaders: createDataLoaders(repos, userId ?? ""),
    userId,
  };
}
