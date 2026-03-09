/// <reference lib="webworker" />

import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope & typeof globalThis;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SweptMind — Offline</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:system-ui,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#fafafa;color:#18181b}
    @media(prefers-color-scheme:dark){body{background:#09090b;color:#fafaf9}}
    .c{max-width:20rem;text-align:center;padding:1rem}
    h1{font-size:1.25rem;font-weight:600;margin-bottom:.5rem}
    p{font-size:.875rem;color:#71717a;line-height:1.5}
    svg{margin:0 auto 1rem;color:#a1a1aa}
  </style>
</head>
<body>
  <div class="c">
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h.01"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/><path d="M5 12.859a10 10 0 0 1 5.17-2.69"/><path d="M13.83 10.17A10 10 0 0 1 19 12.859"/><path d="M2 8.82a15 15 0 0 1 4.17-2.65"/><path d="M10.66 5a15 15 0 0 1 11.34 3.82"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
    <h1>Jsi offline</h1>
    <p>Tuto stránku nemáme v mezipaměti. Jakmile se připojíš k internetu, aplikace se automaticky obnoví.</p>
  </div>
  <script>window.addEventListener("online",()=>location.reload())</script>
</body>
</html>`;

serwist.setCatchHandler(async ({ request }) => {
  if (request.destination === "document") {
    return new Response(OFFLINE_HTML, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
  return Response.error();
});

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

serwist.addEventListeners();
