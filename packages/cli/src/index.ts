#!/usr/bin/env node
import { Command } from "commander";
import { registerAuthCommands } from "./commands/auth.js";

const program = new Command();

program
  .name("sm")
  .description("SweptMind CLI — manage tasks from your terminal")
  .version("0.1.0");

registerAuthCommands(program);

program.parse();
