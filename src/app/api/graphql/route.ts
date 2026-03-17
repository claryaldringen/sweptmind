import { createYoga } from "graphql-yoga";
import { useDepthLimit } from "@envelop/depth-limit";
import { schema } from "@/server/graphql/schema";
import { createContext } from "@/server/graphql/context";
import { NextRequest } from "next/server";
import { rateLimit } from "@/lib/rate-limit";

const yoga = createYoga({
  schema,
  context: createContext,
  graphqlEndpoint: "/api/graphql",
  fetchAPI: { Response },
  plugins: [useDepthLimit({ maxDepth: 10 })],
  maskedErrors: {
    isDev: process.env.NODE_ENV === "development",
  },
  logging: process.env.NODE_ENV === "development" ? "debug" : "info",
});

export async function GET(request: NextRequest) {
  const limited = rateLimit(request, { maxRequests: 100 });
  if (limited) return limited;
  return yoga.handleRequest(request, {});
}

export async function POST(request: NextRequest) {
  const limited = rateLimit(request, { maxRequests: 100 });
  if (limited) return limited;
  return yoga.handleRequest(request, {});
}
