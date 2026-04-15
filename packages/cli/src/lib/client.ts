import { GraphQLClient } from "graphql-request";
import { getToken, getApiUrl } from "./config.js";
import { error } from "./output.js";

let client: GraphQLClient | null = null;
let mcpMode = false;

export function setMcpMode(enabled: boolean): void {
  mcpMode = enabled;
}

function fail(message: string): never {
  if (mcpMode) {
    throw new Error(message);
  }
  error(message);
  process.exit(1);
}

export function getClient(): GraphQLClient {
  if (client) return client;

  const token = getToken();
  if (!token) {
    fail("Nepřihlášen. Spusť 'sm login'.");
  }

  client = new GraphQLClient(`${getApiUrl()}/api/graphql`, {
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  return client;
}

export async function gql<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const c = getClient();
  try {
    return await c.request<T>(query, variables, {
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "response" in err) {
      const response = (
        err as {
          response: { status?: number; errors?: { message: string }[] };
        }
      ).response;
      if (response.status === 401) {
        fail("Nepřihlášen. Spusť 'sm login'.");
      }
      if (response.errors?.length) {
        fail(response.errors[0].message);
      }
    }
    fail(
      "Nelze se připojit k serveru. Zkontroluj připojení nebo 'sm config get apiUrl'.",
    );
  }
}
