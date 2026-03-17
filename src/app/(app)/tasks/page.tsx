import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { services } from "@/infrastructure/container";

export default async function TasksPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const defaultList = await services.list.getDefault(session.user.id);

  if (defaultList) {
    redirect(`/lists/${defaultList.id}`);
  }

  redirect("/planned");
}
