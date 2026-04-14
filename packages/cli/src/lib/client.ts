import { GraphQLClient } from "graphql-request";
import { getToken, getApiUrl } from "./config.js";
import { error } from "./output.js";

let client: GraphQLClient | null = null;

export function getClient(): GraphQLClient {
  if (client) return client;

  const token = getToken();
  if (!token) {
    error("Nepřihlášen. Spusť 'sm login'.");
    process.exit(1);
  }

  client = new GraphQLClient(`${getApiUrl()}/api/graphql`, {
    headers: {
      authorization: `Bearer ${token}`,
    },
    signal: AbortSignal.timeout(10_000),
  });

  return client;
}

export async function gql<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const c = getClient();
  try {
    return await c.request<T>(query, variables);
  } catch (err: unknown) {
    if (err && typeof err === "object" && "response" in err) {
      const response = (
        err as {
          response: { status?: number; errors?: { message: string }[] };
        }
      ).response;
      if (response.status === 401) {
        error("Nepřihlášen. Spusť 'sm login'.");
        process.exit(1);
      }
      if (response.errors?.length) {
        error(response.errors[0].message);
        process.exit(1);
      }
    }
    error(
      "Nelze se připojit k serveru. Zkontroluj připojení nebo 'sm config get apiUrl'.",
    );
    process.exit(1);
  }
}
