import { createYoga } from "graphql-yoga";
import { useDepthLimit } from "@envelop/depth-limit";
import { schema } from "@/server/graphql/schema";
import { createContext } from "@/server/graphql/context";
import { NextRequest } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { auth } from "@/lib/auth";
import { services } from "@/infrastructure/container";

const yoga = createYoga({
  schema,
  context: ({ request }: { request: Request }) => createContext(request),
  graphqlEndpoint: "/api/graphql",
  fetchAPI: { Response },
  // eslint-disable-next-line react-hooks/rules-of-hooks -- Envelop plugin factory, not a React hook
  plugins: [useDepthLimit({ maxDepth: 10 })],
  maskedErrors: {
    isDev: process.env.NODE_ENV === "development",
  },
  logging: process.env.NODE_ENV === "development" ? "debug" : "info",
});

async function getRateLimitKey(request: Request): Promise<string | undefined> {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer sm_")) {
    const userId = await services.apiToken.validateToken(authHeader.slice(7));
    return userId ? `user:${userId}` : undefined;
  }
  const session = await auth();
  return session?.user?.id ? `user:${session.user.id}` : undefined;
}

export async function GET(request: NextRequest) {
  const key = await getRateLimitKey(request);
  const limited = rateLimit(request, { maxRequests: 100, key });
  if (limited) return limited;
  return yoga.handleRequest(request, { request });
}

export async function POST(request: NextRequest) {
  const key = await getRateLimitKey(request);
  const limited = rateLimit(request, { maxRequests: 100, key });
  if (limited) return limited;
  return yoga.handleRequest(request, { request });
}
