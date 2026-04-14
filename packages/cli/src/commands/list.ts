import { Command } from "commander";
import chalk from "chalk";
import { gql } from "../lib/client.js";
import { success, json, shouldOutputJSON, type OutputOptions } from "../lib/output.js";

interface List {
  id: string;
  name: string;
  icon: string | null;
  themeColor: string | null;
  isDefault: boolean;
  sortOrder: number;
  groupId: string | null;
  taskCount: number;
}

export function registerListCommands(program: Command): void {
  const list = program.command("list").description("Správa seznamů");

  list
    .command("ls")
    .description("Zobrazit seznamy")
    .option("--json", "JSON výstup")
    .action(async (opts: OutputOptions) => {
      const data = await gql<{ lists: List[] }>(
        `query { lists { id name icon themeColor isDefault sortOrder groupId taskCount } }`,
      );

      if (shouldOutputJSON(opts)) {
        json(data.lists);
        return;
      }

      for (const l of data.lists) {
        const icon = l.icon || "📋";
        const def = l.isDefault ? chalk.dim(" (výchozí)") : "";
        const count = chalk.dim(`${l.taskCount} úkolů`);
        console.log(` ${icon}  ${l.name}${def}  ${count}  ${chalk.dim(l.id.slice(0, 8))}`);
      }
    });

  list
    .command("create <name>")
    .description("Vytvořit seznam")
    .option("--icon <icon>", "Emoji ikona")
    .option("--json", "JSON výstup")
    .action(async (name: string, opts: OutputOptions & { icon?: string }) => {
      const input: Record<string, unknown> = { name };
      if (opts.icon) input.icon = opts.icon;

      const data = await gql<{ createList: List }>(
        `mutation($input: CreateListInput!) { createList(input: $input) { id name icon } }`,
        { input },
      );

      if (shouldOutputJSON(opts)) {
        json(data.createList);
        return;
      }

      success(`Seznam "${data.createList.name}" vytvořen (${data.createList.id.slice(0, 8)})`);
    });

  list
    .command("show <id>")
    .description("Zobrazit detail seznamu")
    .option("--json", "JSON výstup")
    .action(async (id: string, opts: OutputOptions) => {
      const data = await gql<{ list: List }>(
        `query($id: String!) { list(id: $id) { id name icon themeColor isDefault } }`,
        { id },
      );

      if (shouldOutputJSON(opts)) {
        json(data.list);
        return;
      }

      console.log(`${data.list.icon || "📋"} ${chalk.bold(data.list.name)}`);
      console.log(`ID: ${data.list.id}`);
      if (data.list.isDefault) console.log("Výchozí seznam");
    });

  list
    .command("edit <id>")
    .description("Upravit seznam")
    .option("--name <name>", "Nový název")
    .option("--icon <icon>", "Nová ikona")
    .option("--json", "JSON výstup")
    .action(async (id: string, opts: OutputOptions & { name?: string; icon?: string }) => {
      const input: Record<string, unknown> = {};
      if (opts.name) input.name = opts.name;
      if (opts.icon) input.icon = opts.icon;

      await gql(
        `mutation($id: String!, $input: UpdateListInput!) { updateList(id: $id, input: $input) { id } }`,
        { id, input },
      );

      if (shouldOutputJSON(opts)) {
        json({ updated: true, id });
        return;
      }

      success(`Seznam #${id.slice(0, 8)} upraven`);
    });

  list
    .command("delete <id>")
    .description("Smazat seznam")
    .option("--json", "JSON výstup")
    .action(async (id: string, opts: OutputOptions) => {
      await gql(`mutation($id: String!) { deleteList(id: $id) }`, { id });

      if (shouldOutputJSON(opts)) {
        json({ deleted: true, id });
        return;
      }

      success(`Seznam #${id.slice(0, 8)} smazán`);
    });
}
