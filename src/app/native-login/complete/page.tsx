import type { Metadata } from "next";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { getRequestLocale } from "@/lib/i18n/server";
import {
  createNativeLoginCode,
  isValidChallenge,
  NATIVE_CHALLENGE_COOKIE,
  NATIVE_REDIRECT_URL,
} from "@/lib/native-login";
import { NativeLoginRedirect, NativeLoginSignIn } from "./native-login-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Opened in the system browser by the native app (see src/lib/native-login.ts). */
export default async function NativeLoginCompletePage() {
  const dict = dictionaries[await getRequestLocale()];
  const t = dict.nativeLogin;
  const challenge = (await cookies()).get(NATIVE_CHALLENGE_COOKIE)?.value;
  const secret = process.env.AUTH_SECRET;

  let content: React.ReactNode;
  if (!isValidChallenge(challenge) || !secret) {
    content = <p className="text-sm">{t.expired}</p>;
  } else {
    const session = await auth();
    if (!session?.user?.id) {
      content = <NativeLoginSignIn hint={t.signingIn} buttonLabel={dict.auth.continueGoogle} />;
    } else {
      const code = createNativeLoginCode(session.user.id, challenge, secret);
      content = (
        <NativeLoginRedirect
          href={`${NATIVE_REDIRECT_URL}?code=${encodeURIComponent(code)}`}
          message={t.done}
          openLabel={t.openApp}
          account={t.account.replace("{email}", session.user.email ?? "")}
          otherAccountLabel={t.otherAccount}
        />
      );
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
        <h1 className="text-xl font-semibold">{t.title}</h1>
        {content}
      </div>
    </div>
  );
}
