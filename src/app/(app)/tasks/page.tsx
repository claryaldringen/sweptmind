import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import { lists } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";

export default async function TasksPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const defaultList = await db.query.lists.findFirst({
    where: and(eq(lists.userId, session.user.id), eq(lists.isDefault, true)),
  });

  if (defaultList) {
    redirect(`/lists/${defaultList.id}`);
  }

  redirect("/planned");
}
