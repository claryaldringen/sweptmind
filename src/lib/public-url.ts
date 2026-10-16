/**
 * Absolute URL on the app's public origin. Behind the reverse proxy the standalone server
 * sees its bind address in req.url (https://0.0.0.0:3005/…), so redirects must not use it.
 */
export function publicUrl(path: string, req: { url: string }): URL {
  return new URL(path, process.env.AUTH_URL || req.url);
}
