"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslations } from "@/lib/i18n";

export default function ForgotPasswordPage() {
  const { t } = useTranslations();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;

    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      setSent(true);
      setLoading(false);
    } catch {
      setLoading(false);
      setSent(true); // Still show "sent" to prevent email enumeration
    }
  }

  if (sent) {
    return (
      <div className="text-center">
        <h1 className="mb-3 text-[32px] font-bold">{t("auth.resetLinkSent")}</h1>
        <p className="text-muted-foreground mb-8 text-sm">{t("auth.resetLinkSentDescription")}</p>
        <Link
          href="/login"
          className="text-foreground text-sm font-medium underline underline-offset-4"
        >
          {t("auth.backToLogin")}
        </Link>
      </div>
    );
  }

  return (
    <>
      <h1 className="mb-2 text-center text-[32px] font-bold">{t("auth.forgotPasswordTitle")}</h1>
      <p className="text-muted-foreground mb-8 text-center text-sm">
        {t("auth.forgotPasswordDescription")}
      </p>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-medium">
            {t("auth.email")}
          </label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder={t("auth.emailPlaceholder")}
            className="h-11"
            required
            autoFocus
          />
        </div>
        <Button type="submit" className="h-11 w-full text-base font-semibold" disabled={loading}>
          {loading ? t("auth.sendingResetLink") : t("auth.sendResetLink")}
        </Button>
      </form>

      <p className="text-muted-foreground mt-8 text-center text-sm">
        <Link href="/login" className="text-foreground font-medium underline underline-offset-4">
          {t("auth.backToLogin")}
        </Link>
      </p>
    </>
  );
}
