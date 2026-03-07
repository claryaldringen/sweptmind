import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { services } from "@/infrastructure/container";

export async function POST(request: NextRequest) {
  const limited = rateLimit(request, { maxRequests: 5, windowMs: 300_000 });
  if (limited) return limited;

  const { email } = await request.json();
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const token = await services.auth.requestPasswordReset(email);

  if (token) {
    const resetUrl = `${request.nextUrl.origin}/reset-password?token=${token}`;

    // TODO: Send email via Resend/SendGrid
    // For now, log to console in development
    if (process.env.NODE_ENV === "development") {
      console.log(`\n🔑 Password reset link for ${email}:\n${resetUrl}\n`);
    }
  }

  // Always return success to prevent email enumeration
  return NextResponse.json({ ok: true });
}
