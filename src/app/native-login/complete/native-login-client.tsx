"use client";

import { useEffect } from "react";
import { signIn, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

const COMPLETE_PATH = "/native-login/complete";

/** No session in this browser yet — go straight to Google. */
export function NativeLoginSignIn({ hint, buttonLabel }: { hint: string; buttonLabel: string }) {
  useEffect(() => {
    signIn("google", { redirectTo: COMPLETE_PATH });
  }, []);

  return (
    <>
      <p className="text-muted-foreground text-sm">{hint}</p>
      <Button onClick={() => signIn("google", { redirectTo: COMPLETE_PATH })}>{buttonLabel}</Button>
    </>
  );
}

/** Signed in — hand the code back to the app (the button covers a blocked auto-redirect). */
export function NativeLoginRedirect({
  href,
  message,
  openLabel,
  account,
  otherAccountLabel,
}: {
  href: string;
  message: string;
  openLabel: string;
  account: string;
  otherAccountLabel: string;
}) {
  useEffect(() => {
    window.location.href = href;
  }, [href]);

  return (
    <>
      <p className="text-sm">{message}</p>
      <Button asChild>
        <a href={href}>{openLabel}</a>
      </Button>
      <p className="text-muted-foreground text-xs">{account}</p>
      <Button variant="ghost" size="sm" onClick={() => signOut({ redirectTo: COMPLETE_PATH })}>
        {otherAccountLabel}
      </Button>
    </>
  );
}
