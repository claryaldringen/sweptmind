import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ["@sweptmind/native-bridge"],
  turbopack: {},
  env: {
    NEXT_PUBLIC_BUILD_ID:
      process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev",
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
  async redirects() {
    return [
      {
        source: "/lists",
        destination: "/context",
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/icons/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/og-image.png",
        headers: [
          { key: "Cache-Control", value: "public, max-age=604800" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400" },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self)",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://*.googleusercontent.com https://*.fbcdn.net https://platform-lookaside.fbsbx.com https://*.public.blob.vercel-storage.com",
              "connect-src 'self' https://accounts.google.com https://*.googleapis.com https://*.google.com https://photon.komoot.io https://nominatim.openstreetmap.org https://ipwho.is https://get.geojs.io https://ip-api.com https://ipapi.co https://*.public.blob.vercel-storage.com",
              "font-src 'self'",
              "worker-src 'self'",
              "frame-src 'self' https://accounts.google.com",
              "frame-ancestors 'none'",
              "form-action 'self' https://accounts.google.com",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default withSerwist(nextConfig);
