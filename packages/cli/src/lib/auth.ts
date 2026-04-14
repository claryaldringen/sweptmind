import http from "http";
import open from "open";
import { getApiUrl } from "./config.js";

export function startOAuthFlow(): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url!, `http://localhost`);
      const token = url.searchParams.get("token");

      if (token) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(
          "<html><body><h1>Přihlášení úspěšné!</h1><p>Můžeš zavřít toto okno.</p></body></html>",
        );
        server.close();
        resolve(token);
      } else {
        res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
        res.end("<html><body><h1>Chyba přihlášení</h1></body></html>");
        server.close();
        reject(new Error("No token received"));
      }
    });

    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("Failed to start local server"));
        return;
      }
      const callbackUrl = `http://127.0.0.1:${addr.port}/callback`;
      const authUrl = `${getApiUrl()}/cli/auth?callback=${encodeURIComponent(callbackUrl)}`;
      open(authUrl);
    });

    setTimeout(() => {
      server.close();
      reject(new Error("Login timed out"));
    }, 120_000);
  });
}
