import { HttpLink } from "@apollo/client";
import {
  registerApolloClient,
  InMemoryCache,
  ApolloClient,
} from "@apollo/client-integration-nextjs";

export const { getClient } = registerApolloClient(() => {
  return new ApolloClient({
    cache: new InMemoryCache(),
    link: new HttpLink({
      uri: `${process.env.AUTH_URL || "http://localhost:3000"}/api/graphql`,
    }),
  });
});
