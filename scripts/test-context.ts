import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq, and, or, inArray, asc } from "drizzle-orm";
import * as schema from "../src/server/db/schema";

const pool = new Pool({ connectionString: "postgresql://postgres:postgres@localhost:5432/sweptmind" });
const db = drizzle(pool, { schema, logger: true });

async function test() {
  const userId = "ebcd2170-e30a-44a1-89ea-5b6cc1c7020d";
  const deviceContext = "computer";
  const locationIds = ["6defd1aa-c04b-4486-acff-c2a7a283760e"];

  // Step 1: Find lists
  const contextListConditions = [];
  contextListConditions.push(eq(schema.lists.deviceContext, deviceContext));
  contextListConditions.push(inArray(schema.lists.locationId, locationIds));

  console.log("\n=== Step 1: Find matching lists ===");
  const contextLists = await db.query.lists.findMany({
    where: and(eq(schema.lists.userId, userId), or(...contextListConditions)),
  });
  console.log("Matching lists:", contextLists.map(l => ({ name: l.name, dc: l.deviceContext, loc: l.locationId })));

  const contextListIds = contextLists.map(l => l.id);

  // Step 3: Find tasks  
  const taskConditions = [];
  taskConditions.push(eq(schema.tasks.deviceContext, deviceContext));
  taskConditions.push(inArray(schema.tasks.locationId, locationIds));
  if (contextListIds.length > 0) {
    taskConditions.push(inArray(schema.tasks.listId, contextListIds));
  }

  console.log("\n=== Step 3: Find tasks ===");
  console.log("taskConditions count:", taskConditions.length);
  const tasks = await db.query.tasks.findMany({
    where: and(
      eq(schema.tasks.userId, userId),
      eq(schema.tasks.isCompleted, false),
      or(...taskConditions),
    ),
    orderBy: asc(schema.tasks.sortOrder),
  });

  console.log("\nTasks:", tasks.map(t => t.title));
  
  await pool.end();
}

test().catch(e => { console.error(e); process.exit(1); });
