import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.onboardingCompleted) {
    redirect("/planned");
  }

  return (
    <div className="bg-muted/50 flex min-h-screen items-center justify-center p-4">{children}</div>
  );
}
