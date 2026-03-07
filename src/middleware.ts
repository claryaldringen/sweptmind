import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  if (req.nextUrl.pathname === "/" && req.auth?.user) {
    return NextResponse.redirect(new URL("/planned", req.url));
  }
});

export const config = {
  matcher: ["/"],
};
