import chalk from "chalk";

const isJSON = !process.stdout.isTTY;

export function json(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

export function success(message: string): void {
  if (isJSON) return;
  console.log(chalk.green("\u2713") + " " + message);
}

export function error(message: string): void {
  console.error(chalk.red("\u2717") + " " + message);
}

export function warn(message: string): void {
  if (isJSON) return;
  console.warn(chalk.yellow("\u26A0") + " " + message);
}

export function table(rows: Record<string, string>[]): void {
  if (isJSON) {
    json(rows);
    return;
  }
  console.table(rows);
}

export interface OutputOptions {
  json?: boolean;
}

export function shouldOutputJSON(opts: OutputOptions): boolean {
  return opts.json === true || isJSON;
}
