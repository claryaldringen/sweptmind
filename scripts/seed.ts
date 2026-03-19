import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { hash } from "bcryptjs";
import * as schema from "../src/server/db/schema";

config({ path: ".env.local" });

async function seed() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL!,
  });
  const db = drizzle(pool, { schema });

  console.log("Seeding database...");

  // Create a test user
  const hashedPassword = await hash("password123", 12);
  const [user] = await db
    .insert(schema.users)
    .values({
      name: "Test User",
      email: "test@example.com",
      hashedPassword,
    })
    .returning();

  console.log("Created user:", user.email);

  // Create default "Tasks" list
  const [defaultList] = await db
    .insert(schema.lists)
    .values({
      userId: user.id,
      name: "Tasks",
      isDefault: true,
      sortOrder: 0,
    })
    .returning();

  console.log("Created default list:", defaultList.name);

  // Create sample tasks
  const sampleTasks = [
    { title: "Buy groceries", sortOrder: 0 },
    { title: "Read a book", sortOrder: 1 },
    { title: "Go for a walk", sortOrder: 2 },
    { title: "Finish project report", sortOrder: 3, dueDate: "2026-03-10" },
    { title: "Call dentist", sortOrder: 4, isCompleted: true, completedAt: new Date() },
  ];

  for (const task of sampleTasks) {
    await db.insert(schema.tasks).values({
      userId: user.id,
      listId: defaultList.id,
      ...task,
    });
  }

  console.log(`Created ${sampleTasks.length} sample tasks`);

  // Create additional list
  const [shoppingList] = await db
    .insert(schema.lists)
    .values({
      userId: user.id,
      name: "Shopping",
      sortOrder: 1,
    })
    .returning();

  await db.insert(schema.tasks).values({
    userId: user.id,
    listId: shoppingList.id,
    title: "Milk",
    sortOrder: 0,
  });

  console.log("Created Shopping list with 1 task");

  await pool.end();
  console.log("Seed complete!");
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
