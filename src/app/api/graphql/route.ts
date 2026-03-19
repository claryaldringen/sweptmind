import { createYoga } from "graphql-yoga";
import { useDepthLimit } from "@envelop/depth-limit";
import { schema } from "@/server/graphql/schema";
import { createContext } from "@/server/graphql/context";
import { NextRequest } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { auth } from "@/lib/auth";

const yoga = createYoga({
  schema,
  context: createContext,
  graphqlEndpoint: "/api/graphql",
  fetchAPI: { Response },
  // eslint-disable-next-line react-hooks/rules-of-hooks -- Envelop plugin factory, not a React hook
  plugins: [useDepthLimit({ maxDepth: 10 })],
  maskedErrors: {
    isDev: process.env.NODE_ENV === "development",
  },
  logging: process.env.NODE_ENV === "development" ? "debug" : "info",
});

async function getRateLimitKey(): Promise<string | undefined> {
  const session = await auth();
  return session?.user?.id ? `user:${session.user.id}` : undefined;
}

export async function GET(request: NextRequest) {
  const key = await getRateLimitKey();
  const limited = rateLimit(request, { maxRequests: 100, key });
  if (limited) return limited;
  return yoga.handleRequest(request, {});
}

export async function POST(request: NextRequest) {
  const key = await getRateLimitKey();
  const limited = rateLimit(request, { maxRequests: 100, key });
  if (limited) return limited;
  return yoga.handleRequest(request, {});
}
