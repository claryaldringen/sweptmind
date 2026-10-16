import { NextRequest, NextResponse } from "next/server";
import { isValidChallenge, NATIVE_CHALLENGE_COOKIE } from "@/lib/native-login";

/** Start of the native app's sign-in, opened by the app in the system browser. */
export function GET(req: NextRequest) {
  const challenge = req.nextUrl.searchParams.get("challenge");
  const res = NextResponse.redirect(new URL("/native-login/complete", req.url));
  if (isValidChallenge(challenge)) {
    res.cookies.set(NATIVE_CHALLENGE_COOKIE, challenge, {
      httpOnly: true,
      secure: true,
      sameSite: "lax", // survives the redirect back from Google
      path: "/native-login",
      maxAge: 600,
    });
  }
  return res;
}
