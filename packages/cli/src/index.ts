#!/usr/bin/env node
import { Command } from "commander";
import { registerAuthCommands } from "./commands/auth.js";
import { registerTaskCommands } from "./commands/task.js";
import { registerStepCommands } from "./commands/step.js";
import { registerListCommands } from "./commands/list.js";
import { registerGroupCommands } from "./commands/group.js";
import { registerLocationCommands } from "./commands/location.js";
import { registerShareCommands } from "./commands/share.js";
import { registerCalendarCommands } from "./commands/calendar.js";
import { registerSubscriptionCommands } from "./commands/subscription.js";
import { registerConfigCommands } from "./commands/config.js";

const program = new Command();

program
  .name("sm")
  .description("SweptMind CLI — manage tasks from your terminal")
  .version("0.1.0");

registerAuthCommands(program);
registerTaskCommands(program);
registerStepCommands(program);
registerListCommands(program);
registerGroupCommands(program);
registerLocationCommands(program);
registerShareCommands(program);
registerCalendarCommands(program);
registerSubscriptionCommands(program);
registerConfigCommands(program);

program
  .command("serve")
  .description("Start MCP server (stdio transport)")
  .action(async () => {
    const { startMcpServer } = await import("./mcp-server.js");
    await startMcpServer();
  });

program
  .command("setup")
  .description("Configure SweptMind MCP server for Claude Code")
  .option("--global", "Write to ~/.claude/.mcp.json (default: .mcp.json in current directory)")
  .action(async (opts: { global?: boolean }) => {
    const { writeFileSync, readFileSync, existsSync, mkdirSync } = await import("fs");
    const { join } = await import("path");
    const { homedir } = await import("os");
    const { execSync } = await import("child_process");

    // Find sm binary path
    let smPath: string;
    try {
      smPath = execSync("which sm", { encoding: "utf8" }).trim();
    } catch {
      smPath = process.argv[1];
    }

    const mcpConfig = {
      mcpServers: {
        sweptmind: {
          command: smPath,
          args: ["serve"],
        },
      },
    };

    const targetPath = opts.global
      ? join(homedir(), ".claude", ".mcp.json")
      : join(process.cwd(), ".mcp.json");

    // Merge with existing config if present
    let existing: Record<string, unknown> = {};
    if (existsSync(targetPath)) {
      try {
        existing = JSON.parse(readFileSync(targetPath, "utf8"));
      } catch {
        // ignore parse errors
      }
    }

    const merged = {
      ...existing,
      mcpServers: {
        ...((existing.mcpServers as Record<string, unknown>) || {}),
        ...mcpConfig.mcpServers,
      },
    };

    // Ensure directory exists
    const dir = targetPath.substring(0, targetPath.lastIndexOf("/"));
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(targetPath, JSON.stringify(merged, null, 2) + "\n");
    console.log(`SweptMind MCP server configured in ${targetPath}`);
    console.log("Restart Claude Code to activate.");
  });

program.parse();
