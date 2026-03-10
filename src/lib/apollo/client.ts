import { ApolloLink, HttpLink, Observable } from "@apollo/client";
import { CombinedGraphQLErrors } from "@apollo/client/errors";
import { ErrorLink } from "@apollo/client/link/error";
import { RetryLink } from "@apollo/client/link/retry";
import { ApolloClient, InMemoryCache } from "@apollo/client-integration-nextjs";
import { persistCache } from "apollo3-cache-persist";
import { print } from "graphql";
import { get, set, del } from "idb-keyval";
import { syncManager } from "./sync-manager";

class IdbStorageAdapter {
  async getItem(key: string) {
    return (await get(key)) ?? null;
  }
  async setItem(key: string, value: string) {
    await set(key, value);
  }
  async removeItem(key: string) {
    await del(key);
  }
}

export function makeClient() {
  const errorLink = new ErrorLink(({ error }) => {
    if (CombinedGraphQLErrors.is(error)) {
      error.errors.forEach(({ message }) => {
        console.error(`[GraphQL error]: ${message}`);
      });
    } else {
      console.error(`[Network error]: ${error}`);
    }
  });

  const retryLink = new RetryLink({
    delay: { initial: 1000, max: 10000, jitter: true },
    attempts: {
      max: 3,
      retryIf: (error) => {
        if (!error) return false;
        const statusCode = (error as unknown as Record<string, unknown>).statusCode;
        if (typeof statusCode === "number" && statusCode < 500) return false;
        return true;
      },
    },
  });

  const httpLink = new HttpLink({
    uri: "/api/graphql",
    fetchOptions: { cache: "default" },
  });

  // Offline-aware link: queues mutations when offline
  const offlineLink = new ApolloLink((operation, forward) => {
    const definition = operation.query.definitions[0];
    const isMutation =
      definition.kind === "OperationDefinition" && definition.operation === "mutation";

    if (!isMutation) return forward(operation);

    if (!syncManager.online) {
      // Offline: queue mutation for later replay
      const documentStr = print(operation.query);
      const operationName = operation.operationName || "UnknownMutation";
      syncManager.enqueue(operationName, documentStr, operation.variables);

      // Return empty success — optimistic cache updates already happened
      return new Observable((observer) => {
        observer.next({ data: null });
        observer.complete();
      });
    }

    // Online: forward normally
    return forward(operation);
  });

  const cache = new InMemoryCache();

  const client = new ApolloClient({
    cache,
    link: errorLink.concat(offlineLink).concat(retryLink).concat(httpLink),
    defaultOptions: {
      watchQuery: {
        fetchPolicy: "cache-and-network",
      },
    },
  });

  // Attach client to sync manager for replay
  syncManager.attach(client);

  // Restore cache from IndexedDB (non-blocking — queries fire immediately,
  // cache.restore() triggers watchers when data is ready)
  if (typeof window !== "undefined") {
    persistCache({
      cache,
      storage: new IdbStorageAdapter(),
      maxSize: false,
    }).catch(() => {});
  }

  return client;
}
