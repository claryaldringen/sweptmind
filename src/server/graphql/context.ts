import { auth } from "@/lib/auth";
import { services, repos, type Services } from "@/infrastructure/container";
import { createDataLoaders, type DataLoaders } from "./dataloaders";

export interface GraphQLContext {
  services: Services;
  loaders: DataLoaders;
  userId: string | null;
}

export async function createContext(request?: Request): Promise<GraphQLContext> {
  let userId: string | null = null;

  // Try API token first (Authorization: Bearer sm_...)
  const authHeader = request?.headers.get("authorization");
  if (authHeader?.startsWith("Bearer sm_")) {
    const token = authHeader.slice(7); // "Bearer ".length
    userId = await services.apiToken.validateToken(token);
  }

  // Fall back to session auth
  if (!userId) {
    const session = await auth();
    userId = session?.user?.id ?? null;
  }

  return {
    services,
    loaders: createDataLoaders(repos, userId ?? ""),
    userId,
  };
}
