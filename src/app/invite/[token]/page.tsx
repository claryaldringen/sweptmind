import Link from "next/link";
import { cookies } from "next/headers";
import { CheckCircle2 } from "lucide-react";
import { auth } from "@/lib/auth";
import { repos, services } from "@/infrastructure/container";
import { cs } from "@/lib/i18n/dictionaries/cs";
import { en } from "@/lib/i18n/dictionaries/en";
import type { Locale } from "@/lib/i18n/types";
import { Button } from "@/components/ui/button";
import { AcceptButton } from "./accept-button";

interface InvitePageProps {
  params: Promise<{ token: string }>;
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;

  const cookieStore = await cookies();
  const locale = (cookieStore.get("sweptmind-locale")?.value as Locale) || "cs";
  const dict = locale === "en" ? en : cs;
  const t = dict.sharing;

  // Look up invite
  const invite = await repos.connectionInvite.findByToken(token);

  // Invalid or expired invite
  if (!invite || invite.status !== "pending" || invite.expiresAt < new Date()) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
        <Link href="/" className="mb-8 flex items-center gap-2.5">
          <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
          <span className="text-xl font-semibold tracking-tight">SweptMind</span>
        </Link>
        <div className="w-full max-w-[400px]">
          <div className="bg-destructive/10 text-destructive rounded-lg px-6 py-4 text-center">
            <p className="font-medium">{t.inviteInvalid}</p>
          </div>
          <div className="mt-6 text-center">
            <Link href="/" className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-4">
              {dict.common.notFoundBackHome}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Load inviter info
  const inviter = await services.user.getById(invite.fromUserId);
  const inviterName = inviter?.name ?? inviter?.email ?? "Someone";

  // Check auth
  const session = await auth();
  const userId = session?.user?.id ?? null;

  // Check for error states if authenticated
  let errorMessage: string | null = null;
  if (userId) {
    if (userId === invite.fromUserId) {
      errorMessage = dict.sharing.inviteInvalid;
    } else {
      // Check if already connected
      const existing = await repos.userConnection.findBetween(invite.fromUserId, userId);
      if (existing) {
        errorMessage = t.alreadyConnected;
      }
    }
  }

  const inviteTitle = t.inviteTitle.replace("{name}", inviterName);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <Link href="/" className="mb-8 flex items-center gap-2.5">
        <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
        <span className="text-xl font-semibold tracking-tight">SweptMind</span>
      </Link>

      <div className="w-full max-w-[400px]">
        <h1 className="mb-2 text-center text-[28px] font-bold">{inviteTitle}</h1>

        {!userId ? (
          <>
            <p className="text-muted-foreground mb-8 text-center text-sm">
              in SweptMind
            </p>
            <div className="space-y-3">
              <Button asChild className="h-11 w-full text-base font-semibold">
                <Link href={`/login?callbackUrl=/invite/${token}`}>
                  {t.inviteLogin}
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-11 w-full text-base font-semibold">
                <Link href={`/register?callbackUrl=/invite/${token}`}>
                  {t.inviteRegister}
                </Link>
              </Button>
            </div>
          </>
        ) : errorMessage ? (
          <>
            <div className="bg-destructive/10 text-destructive mt-4 rounded-lg px-4 py-3 text-center text-sm">
              {errorMessage}
            </div>
            <div className="mt-6 text-center">
              <Link href="/settings" className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-4">
                {dict.common.notFoundBackHome}
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="text-muted-foreground mb-8 text-center text-sm">
              {dict.sharing.sharedTasks}
            </p>
            <AcceptButton
              token={token}
              label={t.inviteAccept}
              loadingLabel={dict.common.loading}
            />
          </>
        )}
      </div>
    </div>
  );
}
