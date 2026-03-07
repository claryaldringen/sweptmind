import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq } from "drizzle-orm";
import * as schema from "../src/server/db/schema";

/**
 * Seeds the database with GTD-style lists, tags, and realistic tasks.
 *
 * Lists  = GTD buckets + context lists (where/how you work)
 * Tags   = projects (cross-cutting concerns that span multiple contexts)
 *
 * Usage: npx tsx scripts/seed-gtd.ts [email]
 */
async function seedGtd() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL!,
  });
  const db = drizzle(pool, { schema });

  const targetEmail = process.argv[2];
  const [user] = targetEmail
    ? await db.select().from(schema.users).where(eq(schema.users.email, targetEmail)).limit(1)
    : await db.select().from(schema.users).limit(1);
  if (!user) {
    console.error("No user found. Please create an account first.");
    process.exit(1);
  }
  console.log(`Seeding GTD data for user: ${user.email}`);

  // Clean up existing data
  await db.delete(schema.taskTags).where(eq(schema.taskTags.taskId, ""));
  await db.delete(schema.tags).where(eq(schema.tags.userId, user.id));
  await db.delete(schema.lists).where(eq(schema.lists.userId, user.id));
  await db.delete(schema.listGroups).where(eq(schema.listGroups.userId, user.id));
  console.log("Cleared existing data.");

  // --- List Groups ---
  const [contextsGroup] = await db
    .insert(schema.listGroups)
    .values({ userId: user.id, name: "Contexts", sortOrder: 0 })
    .returning();

  // --- Lists: GTD buckets ---
  const [inbox] = await db
    .insert(schema.lists)
    .values({ userId: user.id, name: "Inbox", isDefault: true, sortOrder: 0 })
    .returning();

  const [nextActions] = await db
    .insert(schema.lists)
    .values({ userId: user.id, name: "Next Actions", sortOrder: 1 })
    .returning();

  const [waitingFor] = await db
    .insert(schema.lists)
    .values({ userId: user.id, name: "Waiting For", sortOrder: 2 })
    .returning();

  const [somedayMaybe] = await db
    .insert(schema.lists)
    .values({ userId: user.id, name: "Someday / Maybe", sortOrder: 3 })
    .returning();

  // --- Lists: Context lists (grouped) ---
  const [atHome] = await db
    .insert(schema.lists)
    .values({ userId: user.id, name: "Home", sortOrder: 4, groupId: contextsGroup.id })
    .returning();

  const [atWork] = await db
    .insert(schema.lists)
    .values({ userId: user.id, name: "Work", sortOrder: 5, groupId: contextsGroup.id })
    .returning();

  const [errands] = await db
    .insert(schema.lists)
    .values({ userId: user.id, name: "Errands", sortOrder: 6, groupId: contextsGroup.id })
    .returning();

  const [computer] = await db
    .insert(schema.lists)
    .values({ userId: user.id, name: "Computer", sortOrder: 7, groupId: contextsGroup.id })
    .returning();

  const [phone] = await db
    .insert(schema.lists)
    .values({ userId: user.id, name: "Phone", sortOrder: 8, groupId: contextsGroup.id })
    .returning();

  console.log("Created lists: Inbox, Next Actions, Waiting For, Someday/Maybe + 5 context lists");

  // --- Tags: Projects ---
  const tagDefs = [
    { name: "Website Redesign", color: "blue" },
    { name: "Apartment Move", color: "orange" },
    { name: "Birthday Party", color: "purple" },
    { name: "Q2 Planning", color: "green" },
    { name: "Health & Fitness", color: "red" },
  ];

  const tagMap: Record<string, string> = {};
  for (const t of tagDefs) {
    const [tag] = await db
      .insert(schema.tags)
      .values({ userId: user.id, name: t.name, color: t.color })
      .returning();
    tagMap[t.name] = tag.id;
  }
  console.log(`Created ${tagDefs.length} project tags`);

  // Helper
  async function createTask(
    listId: string,
    title: string,
    opts: {
      notes?: string;
      dueDate?: string;
      reminderAt?: string;
      recurrence?: string;
      sortOrder?: number;
      isCompleted?: boolean;
      tags?: string[];
      steps?: string[];
    } = {},
  ) {
    const [task] = await db
      .insert(schema.tasks)
      .values({
        userId: user.id,
        listId,
        title,
        notes: opts.notes ?? null,
        dueDate: opts.dueDate ?? null,
        reminderAt: opts.reminderAt ?? opts.dueDate ?? null,
        recurrence: opts.recurrence ?? null,
        sortOrder: opts.sortOrder ?? 0,
        isCompleted: opts.isCompleted ?? false,
        completedAt: opts.isCompleted ? new Date() : null,
      })
      .returning();

    if (opts.tags) {
      for (const tagName of opts.tags) {
        if (tagMap[tagName]) {
          await db.insert(schema.taskTags).values({ taskId: task.id, tagId: tagMap[tagName] });
        }
      }
    }

    if (opts.steps) {
      for (let i = 0; i < opts.steps.length; i++) {
        await db.insert(schema.steps).values({
          taskId: task.id,
          title: opts.steps[i],
          sortOrder: i,
        });
      }
    }

    return task;
  }

  // =====================================================================
  // INBOX — fresh captures, unprocessed thoughts
  // =====================================================================
  await createTask(inbox.id, "Look into meal prep services", { sortOrder: 0 });
  await createTask(inbox.id, "Idea: write a blog post about remote work tips", { sortOrder: 1 });
  await createTask(inbox.id, "Check if passport needs renewing", { sortOrder: 2 });
  await createTask(inbox.id, "Research noise-cancelling headphones", { sortOrder: 3 });
  await createTask(inbox.id, "Mom mentioned a family reunion in July", { sortOrder: 4 });

  // =====================================================================
  // NEXT ACTIONS — concrete, doable tasks (no context yet)
  // =====================================================================
  await createTask(nextActions.id, "File expense report for conference trip", {
    sortOrder: 0,
    dueDate: "2026-03-10",
    tags: ["Q2 Planning"],
    isCompleted: true,
  });
  await createTask(nextActions.id, "Read chapter 5 of Design Patterns book", {
    sortOrder: 1,
    isCompleted: true,
  });

  // =====================================================================
  // HOME context
  // =====================================================================
  await createTask(atHome.id, "Fix the leaky kitchen faucet", {
    sortOrder: 0,
    steps: ["Watch YouTube tutorial", "Buy replacement washer", "Turn off water supply", "Replace washer"],
    tags: ["Apartment Move"],
  });
  await createTask(atHome.id, "Water the plants", {
    sortOrder: 1,
    recurrence: "DAILY",
    dueDate: "2026-03-05",
  });
  await createTask(atHome.id, "Declutter closet and donate old clothes", {
    sortOrder: 2,
    tags: ["Apartment Move"],
  });
  await createTask(atHome.id, "Deep clean the bathroom", {
    sortOrder: 3,
    recurrence: "WEEKLY:6",
    dueDate: "2026-03-07",
  });
  await createTask(atHome.id, "Organize the junk drawer", {
    sortOrder: 4,
    tags: ["Apartment Move"],
  });

  // =====================================================================
  // WORK context
  // =====================================================================
  await createTask(atWork.id, "Reply to Sarah's email about Q2 budget", {
    sortOrder: 0,
    dueDate: "2026-03-05",
    tags: ["Q2 Planning"],
  });
  await createTask(atWork.id, "Prepare slides for Monday standup", {
    sortOrder: 1,
    dueDate: "2026-03-09T09:00",
    tags: ["Q2 Planning"],
  });
  await createTask(atWork.id, "Review and merge PR #142", {
    sortOrder: 2,
    dueDate: "2026-03-06",
    tags: ["Website Redesign"],
  });
  await createTask(atWork.id, "Write copy for About page", {
    sortOrder: 3,
    tags: ["Website Redesign"],
  });
  await createTask(atWork.id, "Set up CI/CD pipeline for staging", {
    sortOrder: 4,
    tags: ["Website Redesign"],
  });
  await createTask(atWork.id, "Book meeting room for Q2 kickoff", {
    sortOrder: 5,
    dueDate: "2026-03-11",
    tags: ["Q2 Planning"],
  });

  // =====================================================================
  // ERRANDS context
  // =====================================================================
  await createTask(errands.id, "Buy birthday gift for Jake", {
    sortOrder: 0,
    dueDate: "2026-03-07",
    tags: ["Birthday Party"],
  });
  await createTask(errands.id, "Take winter clothes to dry cleaner", {
    sortOrder: 1,
  });
  await createTask(errands.id, "Do weekly grocery shopping", {
    sortOrder: 2,
    recurrence: "WEEKLY:6",
    dueDate: "2026-03-07",
  });
  await createTask(errands.id, "Buy packing supplies", {
    sortOrder: 3,
    tags: ["Apartment Move"],
  });
  await createTask(errands.id, "Buy decorations and balloons", {
    sortOrder: 4,
    tags: ["Birthday Party"],
  });
  await createTask(errands.id, "Pick up prescription from pharmacy", {
    sortOrder: 5,
    tags: ["Health & Fitness"],
  });

  // =====================================================================
  // COMPUTER context
  // =====================================================================
  await createTask(computer.id, "Audit current site performance (Lighthouse)", {
    sortOrder: 0,
    tags: ["Website Redesign"],
    isCompleted: true,
  });
  await createTask(computer.id, "Create wireframes for new homepage", {
    sortOrder: 1,
    tags: ["Website Redesign"],
    isCompleted: true,
  });
  await createTask(computer.id, "Choose color palette and typography", {
    sortOrder: 2,
    dueDate: "2026-03-06",
    tags: ["Website Redesign"],
    steps: ["Research competitors", "Create mood board", "Pick 2-3 font pairings", "Get team feedback"],
  });
  await createTask(computer.id, "Build responsive nav component", {
    sortOrder: 3,
    dueDate: "2026-03-12",
    tags: ["Website Redesign"],
  });
  await createTask(computer.id, "Research neighborhoods near the office", {
    sortOrder: 4,
    tags: ["Apartment Move"],
    isCompleted: true,
  });
  await createTask(computer.id, "Create a Spotify playlist for the party", {
    sortOrder: 5,
    tags: ["Birthday Party"],
  });

  // =====================================================================
  // PHONE context
  // =====================================================================
  await createTask(phone.id, "Schedule annual dental checkup", {
    sortOrder: 0,
    tags: ["Health & Fitness"],
  });
  await createTask(phone.id, "Schedule viewings for shortlisted apartments", {
    sortOrder: 1,
    dueDate: "2026-03-10",
    tags: ["Apartment Move"],
  });
  await createTask(phone.id, "Get quotes from 3 moving companies", {
    sortOrder: 2,
    tags: ["Apartment Move"],
  });
  await createTask(phone.id, "Order cake from bakery", {
    sortOrder: 3,
    dueDate: "2026-03-15",
    tags: ["Birthday Party"],
  });
  await createTask(phone.id, "Call gym about membership options", {
    sortOrder: 4,
    tags: ["Health & Fitness"],
  });

  // =====================================================================
  // WAITING FOR — delegated / blocked
  // =====================================================================
  await createTask(waitingFor.id, "Client to send updated brand guidelines", {
    sortOrder: 0,
    tags: ["Website Redesign"],
    notes: "Emailed Lisa on March 1st. Follow up if no response by March 8.",
  });
  await createTask(waitingFor.id, "Landlord to confirm move-out date", {
    sortOrder: 1,
    tags: ["Apartment Move"],
    notes: "Called on Feb 28. Said he'd get back to me this week.",
  });
  await createTask(waitingFor.id, "Amazon delivery — standing desk", {
    sortOrder: 2,
    dueDate: "2026-03-08",
    notes: "Order #ABC-123. Tracking says March 8.",
  });
  await createTask(waitingFor.id, "Tom to review my pull request", {
    sortOrder: 3,
    tags: ["Website Redesign"],
  });
  await createTask(waitingFor.id, "Send out invitations", {
    sortOrder: 4,
    dueDate: "2026-03-10",
    tags: ["Birthday Party"],
    steps: ["Create guest list", "Design invite in Canva", "Send via WhatsApp group"],
  });

  // =====================================================================
  // SOMEDAY / MAYBE — aspirational, no commitment
  // =====================================================================
  await createTask(somedayMaybe.id, "Learn to play the ukulele", { sortOrder: 0 });
  await createTask(somedayMaybe.id, "Take a pottery class", { sortOrder: 1 });
  await createTask(somedayMaybe.id, "Plan a road trip through Portugal", { sortOrder: 2 });
  await createTask(somedayMaybe.id, "Build a mechanical keyboard", { sortOrder: 3 });
  await createTask(somedayMaybe.id, "Try bouldering at the local gym", { sortOrder: 4, tags: ["Health & Fitness"] });
  await createTask(somedayMaybe.id, "Read 'Atomic Habits' by James Clear", { sortOrder: 5 });
  await createTask(somedayMaybe.id, "Set up a home NAS server", { sortOrder: 6 });
  await createTask(somedayMaybe.id, "Update address with bank and insurance", {
    sortOrder: 7,
    tags: ["Apartment Move"],
  });

  console.log("Seed complete! GTD data created successfully.");
  await pool.end();
}

seedGtd().catch((e) => {
  console.error(e);
  process.exit(1);
});
