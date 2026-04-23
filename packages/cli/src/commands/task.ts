import { Command } from "commander";
import chalk from "chalk";
import { gql } from "../lib/client.js";
import { success, error, json, shouldOutputJSON, type OutputOptions } from "../lib/output.js";
import { getConfig } from "../lib/config.js";

interface Task {
  id: string;
  listId: string;
  title: string;
  notes: string | null;
  isCompleted: boolean;
  completedAt: string | null;
  dueDate: string | null;
  reminderAt: string | null;
  sortOrder: number;
  createdAt: string;
  list?: { id: string; name: string };
  steps: { id: string; title: string; isCompleted: boolean; sortOrder: number }[];
}

const TASK_FIELDS = `
  id listId title notes isCompleted completedAt dueDate dueDateEnd
  reminderAt recurrence sortOrder createdAt
  steps { id taskId title isCompleted sortOrder }
`;

export function registerTaskCommands(program: Command): void {
  const task = program.command("task").description("Správa úkolů");

  task
    .command("list")
    .description("Zobrazit úkoly")
    .option("--list <listId>", "Filtrovat podle seznamu (ID nebo název)")
    .option("--planned", "Zobrazit plánované úkoly")
    .option("--with-location", "Úkoly s lokací")
    .option("--completed", "Včetně dokončených")
    .option("--json", "JSON výstup")
    .action(async (opts: OutputOptions & { list?: string; planned?: boolean; withLocation?: boolean; completed?: boolean }) => {
      let tasks: Task[];

      if (opts.planned) {
        const data = await gql<{ plannedTasks: Task[] }>(
          `query { plannedTasks { ${TASK_FIELDS} list { id name } } }`,
        );
        tasks = data.plannedTasks;
      } else if (opts.withLocation) {
        const data = await gql<{ allTasksWithLocation: Task[] }>(
          `query { allTasksWithLocation { ${TASK_FIELDS} list { id name } location { id name } } }`,
        );
        tasks = data.allTasksWithLocation;
      } else {
        const listId = opts.list || getConfig("defaultList");
        if (!listId) {
          error("Specifikuj seznam: --list <id> nebo nastav default: sm config set defaultList <id>");
          process.exit(1);
        }
        const data = await gql<{ tasksByList: Task[] }>(
          `query($listId: String!) { tasksByList(listId: $listId) { ${TASK_FIELDS} } }`,
          { listId },
        );
        tasks = data.tasksByList;
      }

      if (!opts.completed) {
        tasks = tasks.filter((t) => !t.isCompleted);
      }

      if (shouldOutputJSON(opts)) {
        json(tasks);
        return;
      }

      if (tasks.length === 0) {
        console.log("Žádné úkoly.");
        return;
      }

      for (const t of tasks) {
        const check = t.isCompleted ? chalk.green("☑") : chalk.dim("☐");
        const id = chalk.dim(`#${t.id.slice(0, 8)}`);
        const title = t.isCompleted ? chalk.strikethrough(t.title) : t.title;
        const due = t.dueDate ? chalk.cyan(`📅 ${t.dueDate}`) : "";
        console.log(` ${check}  ${id}  ${title}  ${due}`);
      }

      const completed = tasks.filter((t) => t.isCompleted).length;
      console.log(`\n${tasks.length} úkolů${completed > 0 ? ` (${completed} dokončených)` : ""}`);
    });

  task
    .command("show <id>")
    .description("Zobrazit detail úkolu")
    .option("--json", "JSON výstup")
    .action(async (id: string, opts: OutputOptions) => {
      const data = await gql<{ task: Task & { list: { id: string; name: string } } }>(
        `query($id: String!) { task(id: $id) { ${TASK_FIELDS} list { id name } } }`,
        { id },
      );
      const t = data.task;

      if (shouldOutputJSON(opts)) {
        json(t);
        return;
      }

      const status = t.isCompleted ? chalk.green("☑ dokončený") : chalk.dim("☐ nedokončený");
      console.log(`${chalk.bold(t.title)}  ${status}`);
      console.log(chalk.dim("━".repeat(40)));
      console.log(`Seznam:      ${t.list.name}`);
      if (t.dueDate) console.log(`Termín:      ${t.dueDate}`);
      if (t.reminderAt) console.log(`Připomenutí: ${t.reminderAt}`);
      if (t.notes) console.log(`Poznámky:    ${t.notes}`);
      if (t.steps.length > 0) {
        const done = t.steps.filter((s) => s.isCompleted).length;
        console.log(`Kroky:       ${done}/${t.steps.length} hotové`);
        console.log();
        for (const s of t.steps) {
          const check = s.isCompleted ? chalk.green("☑") : chalk.dim("☐");
          console.log(` ${check}  ${s.title}`);
        }
      }
    });

  task
    .command("add <title>")
    .description("Vytvořit nový úkol")
    .option("--list <listId>", "Seznam (ID)")
    .option("--due <date>", "Termín (YYYY-MM-DD)")
    .option("--reminder <datetime>", "Připomenutí (YYYY-MM-DDTHH:mm)")
    .option("--recurrence <pattern>", "Opakování (DAILY | DAILY:N | WEEKLY:1,3,5 | WEEKLY:N:1,3 | MONTHLY | MONTHLY:N | MONTHLY_LAST | YEARLY | YEARLY:N)")
    .option("--notes <notes>", "Poznámky")
    .option("--json", "JSON výstup")
    .action(async (title: string, opts: OutputOptions & { list?: string; due?: string; reminder?: string; recurrence?: string; notes?: string }) => {
      const listId = opts.list || getConfig("defaultList");
      if (!listId) {
        error("Specifikuj seznam: --list <id> nebo nastav default: sm config set defaultList <id>");
        process.exit(1);
      }

      // CreateTaskInput podporuje jen základní pole; reminder a recurrence aplikujeme dodatečně přes updateTask.
      const createInput: Record<string, unknown> = { title, listId };
      if (opts.due) createInput.dueDate = opts.due;
      if (opts.notes) createInput.notes = opts.notes;

      const created = await gql<{ createTask: Task }>(
        `mutation($input: CreateTaskInput!) { createTask(input: $input) { ${TASK_FIELDS} } }`,
        { input: createInput },
      );

      let finalTask = created.createTask;

      if (opts.reminder || opts.recurrence) {
        const updateInput: Record<string, unknown> = {};
        if (opts.reminder) updateInput.reminderAt = opts.reminder;
        if (opts.recurrence) updateInput.recurrence = opts.recurrence;

        const updated = await gql<{ updateTask: Task }>(
          `mutation($id: String!, $input: UpdateTaskInput!) { updateTask(id: $id, input: $input) { ${TASK_FIELDS} } }`,
          { id: finalTask.id, input: updateInput },
        );
        finalTask = updated.updateTask;
      }

      if (shouldOutputJSON(opts)) {
        json(finalTask);
        return;
      }

      success(`Úkol #${finalTask.id.slice(0, 8)} vytvořen`);
    });

  task
    .command("edit <id>")
    .description("Upravit úkol")
    .option("--title <title>", "Nový název")
    .option("--notes <notes>", "Poznámky")
    .option("--due <date>", "Termín")
    .option("--reminder <datetime>", "Připomenutí")
    .option("--recurrence <pattern>", "Opakování (DAILY | DAILY:N | WEEKLY:1,3,5 | WEEKLY:N:1,3 | MONTHLY | MONTHLY:N | MONTHLY_LAST | YEARLY | YEARLY:N; prázdný řetězec zruší)")
    .option("--json", "JSON výstup")
    .action(async (id: string, opts: OutputOptions & { title?: string; notes?: string; due?: string; reminder?: string; recurrence?: string }) => {
      const input: Record<string, unknown> = {};
      if (opts.title) input.title = opts.title;
      if (opts.notes) input.notes = opts.notes;
      if (opts.due) input.dueDate = opts.due;
      if (opts.reminder) input.reminderAt = opts.reminder;
      if (opts.recurrence !== undefined) input.recurrence = opts.recurrence === "" ? null : opts.recurrence;

      const data = await gql<{ updateTask: Task }>(
        `mutation($id: String!, $input: UpdateTaskInput!) { updateTask(id: $id, input: $input) { id title } }`,
        { id, input },
      );

      if (shouldOutputJSON(opts)) {
        json(data.updateTask);
        return;
      }

      success(`Úkol #${id.slice(0, 8)} upraven`);
    });

  task
    .command("complete <id>")
    .description("Označit úkol jako dokončený")
    .option("--json", "JSON výstup")
    .action(async (id: string, opts: OutputOptions) => {
      const data = await gql<{ toggleTaskCompleted: { id: string; isCompleted: boolean } }>(
        `mutation($id: String!) { toggleTaskCompleted(id: $id) { id isCompleted } }`,
        { id },
      );

      if (shouldOutputJSON(opts)) {
        json(data.toggleTaskCompleted);
        return;
      }

      success(`Úkol #${id.slice(0, 8)} ${data.toggleTaskCompleted.isCompleted ? "dokončen" : "označen jako nedokončený"}`);
    });

  task
    .command("uncomplete <id>")
    .description("Označit úkol jako nedokončený")
    .option("--json", "JSON výstup")
    .action(async (id: string, opts: OutputOptions) => {
      const data = await gql<{ toggleTaskCompleted: { id: string; isCompleted: boolean } }>(
        `mutation($id: String!) { toggleTaskCompleted(id: $id) { id isCompleted } }`,
        { id },
      );

      if (shouldOutputJSON(opts)) {
        json(data.toggleTaskCompleted);
        return;
      }

      success(`Úkol #${id.slice(0, 8)} ${data.toggleTaskCompleted.isCompleted ? "dokončen" : "označen jako nedokončený"}`);
    });

  task
    .command("delete <id>")
    .description("Smazat úkol")
    .option("--json", "JSON výstup")
    .action(async (id: string, opts: OutputOptions) => {
      await gql<{ deleteTask: boolean }>(
        `mutation($id: String!) { deleteTask(id: $id) }`,
        { id },
      );

      if (shouldOutputJSON(opts)) {
        json({ deleted: true, id });
        return;
      }

      success(`Úkol #${id.slice(0, 8)} smazán`);
    });

  task
    .command("move <id>")
    .description("Přesunout úkol do jiného seznamu")
    .requiredOption("--list <listId>", "Cílový seznam (ID)")
    .option("--json", "JSON výstup")
    .action(async (id: string, opts: OutputOptions & { list: string }) => {
      const data = await gql<{ updateTask: { id: string; listId: string } }>(
        `mutation($id: String!, $input: UpdateTaskInput!) { updateTask(id: $id, input: $input) { id listId } }`,
        { id, input: { listId: opts.list } },
      );

      if (shouldOutputJSON(opts)) {
        json(data.updateTask);
        return;
      }

      success(`Úkol #${id.slice(0, 8)} přesunut`);
    });

  task
    .command("clone <id>")
    .description("Klonovat úkol")
    .option("--json", "JSON výstup")
    .action(async (id: string, opts: OutputOptions) => {
      const data = await gql<{ cloneTask: Task }>(
        `mutation($id: String!) { cloneTask(id: $id) { id title } }`,
        { id },
      );

      if (shouldOutputJSON(opts)) {
        json(data.cloneTask);
        return;
      }

      success(`Úkol klonován → #${data.cloneTask.id.slice(0, 8)}`);
    });

  task
    .command("import <file>")
    .description("Importovat úkoly z JSON souboru")
    .option("--json", "JSON výstup")
    .action(async (file: string, opts: OutputOptions) => {
      const fs = await import("fs/promises");
      const content = await fs.readFile(file, "utf-8");
      const tasks = JSON.parse(content);

      const data = await gql<{ importTasks: { importedCount: number; createdLists: string[] } }>(
        `mutation($input: [ImportTaskInput!]!) { importTasks(input: $input) { importedCount createdLists } }`,
        { input: tasks },
      );

      if (shouldOutputJSON(opts)) {
        json(data.importTasks);
        return;
      }

      success(`Importováno ${data.importTasks.importedCount} úkolů`);
      if (data.importTasks.createdLists.length > 0) {
        console.log(`Vytvořené seznamy: ${data.importTasks.createdLists.join(", ")}`);
      }
    });
}
