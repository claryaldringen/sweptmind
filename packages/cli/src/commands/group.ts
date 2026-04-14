import { Command } from "commander";
import chalk from "chalk";
import { gql } from "../lib/client.js";
import { success, json, shouldOutputJSON, type OutputOptions } from "../lib/output.js";

interface ListGroup {
  id: string;
  name: string;
  sortOrder: number;
  lists: { id: string; name: string }[];
}

export function registerGroupCommands(program: Command): void {
  const group = program.command("group").description("Správa skupin seznamů");

  group
    .command("ls")
    .description("Zobrazit skupiny")
    .option("--json", "JSON výstup")
    .action(async (opts: OutputOptions) => {
      const data = await gql<{ listGroups: ListGroup[] }>(
        `query { listGroups { id name sortOrder lists { id name } } }`,
      );

      if (shouldOutputJSON(opts)) {
        json(data.listGroups);
        return;
      }

      for (const g of data.listGroups) {
        console.log(`${chalk.bold(g.name)}  ${chalk.dim(g.id.slice(0, 8))}`);
        for (const l of g.lists) {
          console.log(`  └ ${l.name}  ${chalk.dim(l.id.slice(0, 8))}`);
        }
      }
    });

  group
    .command("create <name>")
    .description("Vytvořit skupinu")
    .option("--json", "JSON výstup")
    .action(async (name: string, opts: OutputOptions) => {
      const data = await gql<{ createListGroup: { id: string; name: string } }>(
        `mutation($input: CreateListGroupInput!) { createListGroup(input: $input) { id name } }`,
        { input: { name } },
      );

      if (shouldOutputJSON(opts)) {
        json(data.createListGroup);
        return;
      }

      success(`Skupina "${name}" vytvořena`);
    });

  group
    .command("delete <id>")
    .description("Smazat skupinu")
    .option("--json", "JSON výstup")
    .action(async (id: string, opts: OutputOptions) => {
      await gql(`mutation($id: String!) { deleteListGroup(id: $id) }`, { id });

      if (shouldOutputJSON(opts)) {
        json({ deleted: true, id });
        return;
      }

      success(`Skupina #${id.slice(0, 8)} smazána`);
    });
}
