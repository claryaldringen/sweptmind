import { HttpLink } from "@apollo/client";
import { CombinedGraphQLErrors } from "@apollo/client/errors";
import { ErrorLink } from "@apollo/client/link/error";
import { RetryLink } from "@apollo/client/link/retry";
import { ApolloClient, InMemoryCache } from "@apollo/client-integration-nextjs";
import { get, set, del } from "idb-keyval";

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

  const cache = new InMemoryCache();

  const client = new ApolloClient({
    cache,
    link: errorLink.concat(retryLink).concat(httpLink),
    defaultOptions: {
      watchQuery: {
        fetchPolicy: "cache-first",
      },
    },
  });

  // Best-effort cache persistence to IndexedDB (client-side only)
  if (typeof window !== "undefined") {
    import("apollo3-cache-persist")
      .then(({ persistCache }) =>
        persistCache({
          cache,
          storage: new IdbStorageAdapter(),
          maxSize: false, // no size limit for IndexedDB
        }),
      )
      .catch(() => {
        // Cache persistence is non-critical — app works fine without it
      });
  }

  return client;
}
