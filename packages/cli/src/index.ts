#!/usr/bin/env node
import { Command } from "commander";

const program = new Command();

program
  .name("sm")
  .description("SweptMind CLI \u2014 manage tasks from your terminal")
  .version("0.1.0");

// Commands will be registered here in subsequent tasks

program.parse();
