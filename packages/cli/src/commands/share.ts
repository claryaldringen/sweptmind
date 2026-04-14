import { Command } from "commander";
import chalk from "chalk";
import { gql } from "../lib/client.js";
import { success, json, shouldOutputJSON, type OutputOptions } from "../lib/output.js";

export function registerShareCommands(program: Command): void {
  const share = program.command("share").description("Sdílení úkolů");

  share
    .command("add <taskId>")
    .description("Sdílet úkol s uživatelem")
    .requiredOption("--user <userId>", "ID uživatele")
    .option("--json", "JSON výstup")
    .action(async (taskId: string, opts: OutputOptions & { user: string }) => {
      await gql(`mutation($taskId: String!, $targetUserId: String!) { shareTask(taskId: $taskId, targetUserId: $targetUserId) }`, { taskId, targetUserId: opts.user });
      if (shouldOutputJSON(opts)) { json({ shared: true, taskId, userId: opts.user }); return; }
      success(`Úkol #${taskId.slice(0, 8)} sdílen`);
    });

  share
    .command("remove <sharedTaskId>")
    .description("Zrušit sdílení úkolu")
    .option("--json", "JSON výstup")
    .action(async (sharedTaskId: string, opts: OutputOptions) => {
      await gql(`mutation($sharedTaskId: String!) { unshareTask(sharedTaskId: $sharedTaskId) }`, { sharedTaskId });
      if (shouldOutputJSON(opts)) { json({ unshared: true, sharedTaskId }); return; }
      success("Sdílení zrušeno");
    });

  share
    .command("list <taskId>")
    .description("Zobrazit sdílení úkolu")
    .option("--json", "JSON výstup")
    .action(async (taskId: string, opts: OutputOptions) => {
      const data = await gql<{ taskShares: { id: string; sharedWith: { name: string; email: string }; createdAt: string }[] }>(
        `query($taskId: String!) { taskShares(taskId: $taskId) { id sharedWith { name email } createdAt } }`, { taskId },
      );
      if (shouldOutputJSON(opts)) { json(data.taskShares); return; }
      if (data.taskShares.length === 0) { console.log("Úkol není sdílen."); return; }
      for (const s of data.taskShares) {
        console.log(` 👤  ${s.sharedWith.name ?? s.sharedWith.email}  ${chalk.dim(new Date(s.createdAt).toLocaleDateString("cs"))}`);
      }
    });

  // Connection commands
  const connection = program.command("connection").description("Správa propojení s uživateli");

  connection
    .command("ls")
    .description("Zobrazit propojení")
    .option("--json", "JSON výstup")
    .action(async (opts: OutputOptions) => {
      const data = await gql<{ connections: { id: string; connectedUser: { name: string; email: string }; sharedTaskCount: number }[] }>(
        `query { connections { id connectedUser { name email } sharedTaskCount createdAt } }`,
      );
      if (shouldOutputJSON(opts)) { json(data.connections); return; }
      if (data.connections.length === 0) { console.log("Žádná propojení."); return; }
      for (const c of data.connections) {
        console.log(` 🔗  ${c.connectedUser.name ?? c.connectedUser.email}  ${chalk.dim(`${c.sharedTaskCount} sdílených úkolů`)}`);
      }
    });

  connection
    .command("invite")
    .description("Vytvořit pozvánku k propojení")
    .option("--json", "JSON výstup")
    .action(async (opts: OutputOptions) => {
      const data = await gql<{ createConnectionInvite: { id: string; token: string; expiresAt: string } }>(
        `mutation { createConnectionInvite { id token expiresAt } }`,
      );
      if (shouldOutputJSON(opts)) { json(data.createConnectionInvite); return; }
      success("Pozvánka vytvořena");
      console.log(`Token: ${data.createConnectionInvite.token}`);
      console.log(`Vyprší: ${new Date(data.createConnectionInvite.expiresAt).toLocaleString("cs")}`);
    });

  connection
    .command("remove <connectedUserId>")
    .description("Zrušit propojení")
    .option("--json", "JSON výstup")
    .action(async (connectedUserId: string, opts: OutputOptions) => {
      await gql(`mutation($connectedUserId: ID!) { disconnect(connectedUserId: $connectedUserId) }`, { connectedUserId });
      if (shouldOutputJSON(opts)) { json({ disconnected: true, connectedUserId }); return; }
      success("Propojení zrušeno");
    });
}
