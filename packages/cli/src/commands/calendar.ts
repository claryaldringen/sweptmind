import { Command } from "commander";
import { gql } from "../lib/client.js";
import { success, json, shouldOutputJSON, type OutputOptions } from "../lib/output.js";

export function registerCalendarCommands(program: Command): void {
  const cal = program.command("calendar").description("Kalendář");

  cal
    .command("sync")
    .description("Synchronizovat kalendář")
    .option("--json", "JSON výstup")
    .action(async (opts: OutputOptions) => {
      await gql(`query { calendarSyncAll }`);
      if (shouldOutputJSON(opts)) { json({ synced: true }); return; }
      success("Kalendář synchronizován");
    });
}
