import { Command } from "commander";
import chalk from "chalk";
import { getConfig, setConfig, getAllConfig, resetConfig } from "../lib/config.js";
import { success, json, shouldOutputJSON, type OutputOptions } from "../lib/output.js";

const VALID_KEYS = ["apiUrl", "token", "locale", "defaultList"] as const;
type ConfigKey = (typeof VALID_KEYS)[number];

function isValidKey(key: string): key is ConfigKey {
  return VALID_KEYS.includes(key as ConfigKey);
}

function maskToken(value: string): string {
  if (!value || value.length < 10) return value;
  return value.slice(0, 6) + "****";
}

export function registerConfigCommands(program: Command): void {
  const cfg = program.command("config").description("Nastavení CLI");

  cfg
    .command("ls")
    .description("Zobrazit nastavení")
    .option("--json", "JSON výstup")
    .action((opts: OutputOptions) => {
      const all = getAllConfig();
      if (shouldOutputJSON(opts)) { json({ ...all, token: all.token ? maskToken(all.token) : "" }); return; }
      for (const [key, value] of Object.entries(all)) {
        const display = key === "token" ? maskToken(value as string) : value;
        console.log(`${chalk.bold(key)}: ${display || chalk.dim("(empty)")}`);
      }
    });

  cfg
    .command("get <key>")
    .description("Zobrazit hodnotu nastavení")
    .action((key: string) => {
      if (!isValidKey(key)) { console.error(`Neplatný klíč: ${key}. Platné: ${VALID_KEYS.join(", ")}`); process.exit(1); }
      const value = getConfig(key);
      console.log(key === "token" ? maskToken(value) : value);
    });

  cfg
    .command("set <key> <value>")
    .description("Nastavit hodnotu")
    .action((key: string, value: string) => {
      if (!isValidKey(key)) { console.error(`Neplatný klíč: ${key}. Platné: ${VALID_KEYS.join(", ")}`); process.exit(1); }
      setConfig(key, value);
      success(`${key} nastaveno`);
    });

  cfg
    .command("reset")
    .description("Smazat veškeré nastavení")
    .action(() => {
      resetConfig();
      success("Nastavení smazáno");
    });
}
