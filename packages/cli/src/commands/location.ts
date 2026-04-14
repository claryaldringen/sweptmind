import { Command } from "commander";
import chalk from "chalk";
import { gql } from "../lib/client.js";
import { success, json, shouldOutputJSON, type OutputOptions } from "../lib/output.js";

interface Location {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address: string | null;
}

export function registerLocationCommands(program: Command): void {
  const loc = program.command("location").description("Správa lokací");

  loc
    .command("ls")
    .description("Zobrazit lokace")
    .option("--json", "JSON výstup")
    .action(async (opts: OutputOptions) => {
      const data = await gql<{ locations: Location[] }>(
        `query { locations { id name latitude longitude address } }`,
      );
      if (shouldOutputJSON(opts)) { json(data.locations); return; }
      for (const l of data.locations) {
        console.log(` 📍  ${l.name}  ${chalk.dim(`${l.latitude}, ${l.longitude}`)}  ${chalk.dim(l.id.slice(0, 8))}`);
        if (l.address) console.log(`     ${chalk.dim(l.address)}`);
      }
    });

  loc
    .command("create <name>")
    .description("Vytvořit lokaci")
    .requiredOption("--lat <latitude>", "Zeměpisná šířka", parseFloat)
    .requiredOption("--lng <longitude>", "Zeměpisná délka", parseFloat)
    .option("--radius <radius>", "Poloměr v metrech", parseFloat)
    .option("--address <address>", "Adresa")
    .option("--json", "JSON výstup")
    .action(async (name: string, opts: OutputOptions & { lat: number; lng: number; radius?: number; address?: string }) => {
      const input: Record<string, unknown> = { name, latitude: opts.lat, longitude: opts.lng };
      if (opts.radius) input.radius = opts.radius;
      if (opts.address) input.address = opts.address;
      const data = await gql<{ createLocation: Location }>(
        `mutation($input: CreateLocationInput!) { createLocation(input: $input) { id name latitude longitude address } }`,
        { input },
      );
      if (shouldOutputJSON(opts)) { json(data.createLocation); return; }
      success(`Lokace "${name}" vytvořena`);
    });

  loc
    .command("edit <id>")
    .description("Upravit lokaci")
    .option("--name <name>", "Nový název")
    .option("--lat <latitude>", "Zeměpisná šířka", parseFloat)
    .option("--lng <longitude>", "Zeměpisná délka", parseFloat)
    .option("--address <address>", "Adresa")
    .option("--json", "JSON výstup")
    .action(async (id: string, opts: OutputOptions & { name?: string; lat?: number; lng?: number; address?: string }) => {
      const input: Record<string, unknown> = {};
      if (opts.name) input.name = opts.name;
      if (opts.lat !== undefined) input.latitude = opts.lat;
      if (opts.lng !== undefined) input.longitude = opts.lng;
      if (opts.address) input.address = opts.address;
      await gql(`mutation($id: String!, $input: UpdateLocationInput!) { updateLocation(id: $id, input: $input) { id } }`, { id, input });
      if (shouldOutputJSON(opts)) { json({ updated: true, id }); return; }
      success(`Lokace #${id.slice(0, 8)} upravena`);
    });

  loc
    .command("delete <id>")
    .description("Smazat lokaci")
    .option("--json", "JSON výstup")
    .action(async (id: string, opts: OutputOptions) => {
      await gql(`mutation($id: String!) { deleteLocation(id: $id) }`, { id });
      if (shouldOutputJSON(opts)) { json({ deleted: true, id }); return; }
      success(`Lokace #${id.slice(0, 8)} smazána`);
    });
}
