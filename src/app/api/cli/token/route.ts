import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { services } from "@/infrastructure/container";

// POST /api/cli/token — exchange authenticated session for API token
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const name = body.name || "CLI";
  const callbackUrl = body.callbackUrl;

  const { rawToken, token } = await services.apiToken.createToken(
    session.user.id,
    name,
  );

  if (callbackUrl) {
    const url = new URL(callbackUrl);
    url.searchParams.set("token", rawToken);
    return NextResponse.redirect(url.toString());
  }

  return NextResponse.json({ token: rawToken, id: token.id, name: token.name });
}
