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

program.parse();
