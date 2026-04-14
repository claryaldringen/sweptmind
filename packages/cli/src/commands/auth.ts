import { Command } from "commander";
import { setConfig, getApiUrl } from "../lib/config.js";
import { startOAuthFlow } from "../lib/auth.js";
import { gql } from "../lib/client.js";
import {
  success,
  error,
  json,
  shouldOutputJSON,
  type OutputOptions,
} from "../lib/output.js";

export function registerAuthCommands(program: Command): void {
  program
    .command("login")
    .description("Přihlásit se do SweptMind")
    .option("--token <token>", "Použít API token místo OAuth")
    .action(async (opts: { token?: string }) => {
      if (opts.token) {
        setConfig("token", opts.token);
        success("Token uložen.");
        return;
      }

      try {
        console.log("Otevírám prohlížeč pro přihlášení...");
        const token = await startOAuthFlow();
        setConfig("token", token);
        success("Přihlášení úspěšné!");
      } catch (err) {
        error(
          `Přihlášení selhalo: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
        process.exit(1);
      }
    });

  program
    .command("logout")
    .description("Odhlásit se")
    .action(() => {
      setConfig("token", "");
      success("Odhlášen.");
    });

  program
    .command("whoami")
    .description("Zobrazit přihlášeného uživatele")
    .option("--json", "JSON výstup")
    .action(async (opts: OutputOptions) => {
      const data = await gql<{
        me: {
          id: string;
          name: string;
          email: string;
          isPremium: boolean;
        };
      }>(`query { me { id name email isPremium } }`);

      if (shouldOutputJSON(opts)) {
        json(data.me);
        return;
      }

      console.log(`${data.me.name ?? data.me.email} (${data.me.email})`);
      if (data.me.isPremium) console.log("⭐ Premium");
    });
}
