import { Command } from "commander";
import chalk from "chalk";
import { gql } from "../lib/client.js";
import { json, shouldOutputJSON, type OutputOptions } from "../lib/output.js";

export function registerSubscriptionCommands(program: Command): void {
  const sub = program.command("subscription").description("Předplatné");

  sub
    .command("status")
    .description("Zobrazit stav předplatného")
    .option("--json", "JSON výstup")
    .action(async (opts: OutputOptions) => {
      const data = await gql<{ subscription: { status: string; plan: string; currentPeriodEnd: string } | null }>(
        `query { subscription { id status plan paymentMethod currentPeriodEnd createdAt } }`,
      );
      if (shouldOutputJSON(opts)) { json(data.subscription); return; }
      if (!data.subscription) { console.log("Žádné aktivní předplatné."); return; }
      const s = data.subscription;
      console.log(`Plán:    ${chalk.bold(s.plan)}`);
      console.log(`Status:  ${s.status === "active" ? chalk.green(s.status) : chalk.yellow(s.status)}`);
      if (s.currentPeriodEnd) console.log(`Platí do: ${new Date(s.currentPeriodEnd).toLocaleDateString("cs")}`);
    });
}
