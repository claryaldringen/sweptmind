import { HttpLink } from "@apollo/client";
import { CombinedGraphQLErrors } from "@apollo/client/errors";
import { ErrorLink } from "@apollo/client/link/error";
import { RetryLink } from "@apollo/client/link/retry";
import { ApolloClient, InMemoryCache } from "@apollo/client-integration-nextjs";

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

  // Best-effort cache persistence to localStorage (client-side only)
  if (typeof window !== "undefined") {
    import("apollo3-cache-persist")
      .then(({ persistCache, LocalStorageWrapper }) =>
        persistCache({
          cache,
          storage: new LocalStorageWrapper(window.localStorage),
          maxSize: 1048576 * 5, // 5 MB
        }),
      )
      .catch(() => {
        // Cache persistence is non-critical — app works fine without it
      });
  }

  return client;
}
