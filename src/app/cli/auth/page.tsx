import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function CliAuthPage({
  searchParams,
}: {
  searchParams: Promise<{ callback?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;
  const callbackUrl = params.callback;

  if (!session?.user) {
    const returnUrl = `/cli/auth${callbackUrl ? `?callback=${encodeURIComponent(callbackUrl)}` : ""}`;
    redirect(`/login?callbackUrl=${encodeURIComponent(returnUrl)}`);
  }

  // User is authenticated — auto-create token and redirect to CLI
  if (callbackUrl) {
    const response = await fetch(`${process.env.AUTH_URL}/api/cli/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callbackUrl, name: "CLI" }),
    });
    const data = await response.json();
    const url = new URL(callbackUrl);
    url.searchParams.set("token", data.token);
    redirect(url.toString());
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold">{"CLI P\u0159ihl\u00e1\u0161en\u00ed"}</h1>
        <p className="text-muted-foreground mt-2">
          {"P\u0159ihl\u00e1\u0161en jako "}{session.user.name ?? session.user.email}{". Zav\u0159i toto okno."}
        </p>
      </div>
    </div>
  );
}
