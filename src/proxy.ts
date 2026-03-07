export { auth as proxy } from "@/lib/auth";

export const config = {
  matcher: ["/planned/:path*", "/tasks/:path*", "/lists/:path*", "/settings/:path*"],
};
