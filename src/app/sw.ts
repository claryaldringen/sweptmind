/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { defaultCache } from "@serwist/turbopack/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: false,
  runtimeCaching: defaultCache,
});

// Allow the client to trigger skipWaiting when user clicks "Update"
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Pre-warm cache with key app routes after activation
const APP_SHELL_ROUTES = ["/lists", "/planned", "/context", "/settings"];

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open("pages");
      for (const route of APP_SHELL_ROUTES) {
        try {
          const response = await fetch(route);
          if (response.ok) {
            await cache.put(route, response);
          }
        } catch {
          // Skip — will be cached on first visit
        }
      }
    })(),
  );
});

// Handle navigation requests with guaranteed offline fallback.
// Registered BEFORE serwist.addEventListeners() so we intercept navigations first.
// Serwist still handles all non-navigation requests (JS, CSS, images, API, RSC payloads).
self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(event.request);
          // Cache successful navigation for offline use
          const cache = await caches.open("pages");
          cache.put(event.request, response.clone());
          return response;
        } catch {
          // Network failed — try cache, then precached offline page
          const cached = await caches.match(event.request);
          if (cached) return cached;
          const offlinePage = await caches.match("/~offline");
          return (
            offlinePage ??
            new Response("Offline", {
              status: 503,
              headers: { "Content-Type": "text/plain" },
            })
          );
        }
      })(),
    );
  }
});

// Serwist handles everything else (static assets, API calls, RSC payloads, etc.)
serwist.addEventListeners();

self.addEventListener("push", (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title ?? "SweptMind", {
        body: data.body ?? "",
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        data: { url: data.url ?? "/" },
      }),
    );
  } catch {
    // Ignore malformed push payloads
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data?.url as string) ?? "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      for (const client of clients) {
        if (new URL(client.url).pathname === url.split("?")[0] && "focus" in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
