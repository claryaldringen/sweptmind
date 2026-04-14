import { Command } from "commander";
import chalk from "chalk";
import { gql } from "../lib/client.js";
import { success, json, shouldOutputJSON, type OutputOptions } from "../lib/output.js";

interface Step {
  id: string;
  taskId: string;
  title: string;
  isCompleted: boolean;
  sortOrder: number;
}

export function registerStepCommands(program: Command): void {
  const step = program.command("step").description("Správa kroků (podúkolů)");

  step
    .command("add <taskId> <title>")
    .description("Přidat krok k úkolu")
    .option("--json", "JSON výstup")
    .action(async (taskId: string, title: string, opts: OutputOptions) => {
      const data = await gql<{ createStep: Step }>(
        `mutation($input: CreateStepInput!) { createStep(input: $input) { id taskId title isCompleted sortOrder } }`,
        { input: { taskId, title } },
      );

      if (shouldOutputJSON(opts)) {
        json(data.createStep);
        return;
      }

      success(`Krok přidán k úkolu #${taskId.slice(0, 8)}`);
    });

  step
    .command("list <taskId>")
    .description("Zobrazit kroky úkolu")
    .option("--json", "JSON výstup")
    .action(async (taskId: string, opts: OutputOptions) => {
      const data = await gql<{ task: { steps: Step[] } }>(
        `query($id: String!) { task(id: $id) { steps { id taskId title isCompleted sortOrder } } }`,
        { id: taskId },
      );

      if (shouldOutputJSON(opts)) {
        json(data.task.steps);
        return;
      }

      if (data.task.steps.length === 0) {
        console.log("Žádné kroky.");
        return;
      }

      for (const s of data.task.steps) {
        const check = s.isCompleted ? chalk.green("☑") : chalk.dim("☐");
        console.log(` ${check}  ${s.title}  ${chalk.dim(`(${s.id.slice(0, 8)})`)}`);
      }
    });

  step
    .command("complete <id>")
    .description("Dokončit krok")
    .option("--json", "JSON výstup")
    .action(async (id: string, opts: OutputOptions) => {
      const data = await gql<{ toggleStepCompleted: { id: string; isCompleted: boolean } }>(
        `mutation($id: String!) { toggleStepCompleted(id: $id) { id isCompleted } }`,
        { id },
      );

      if (shouldOutputJSON(opts)) {
        json(data.toggleStepCompleted);
        return;
      }

      success(`Krok #${id.slice(0, 8)} ${data.toggleStepCompleted.isCompleted ? "dokončen" : "nedokončen"}`);
    });

  step
    .command("delete <id>")
    .description("Smazat krok")
    .option("--json", "JSON výstup")
    .action(async (id: string, opts: OutputOptions) => {
      await gql<{ deleteStep: boolean }>(
        `mutation($id: String!) { deleteStep(id: $id) }`,
        { id },
      );

      if (shouldOutputJSON(opts)) {
        json({ deleted: true, id });
        return;
      }

      success(`Krok #${id.slice(0, 8)} smazán`);
    });
}
