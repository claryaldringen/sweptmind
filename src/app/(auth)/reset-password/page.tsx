"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslations } from "@/lib/i18n";

export default function ResetPasswordPage() {
  const { t } = useTranslations();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (!token) {
    return (
      <div className="text-center">
        <h1 className="mb-3 text-[32px] font-bold">{t("auth.resetPasswordTitle")}</h1>
        <p className="text-destructive mb-8 text-sm">{t("auth.invalidResetToken")}</p>
        <Link
          href="/forgot-password"
          className="text-foreground text-sm font-medium underline underline-offset-4"
        >
          {t("auth.forgotPassword")}
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="text-center">
        <h1 className="mb-3 text-[32px] font-bold">{t("auth.resetPasswordTitle")}</h1>
        <p className="text-muted-foreground mb-8 text-sm">{t("auth.passwordResetSuccess")}</p>
        <Link
          href="/login"
          className="text-foreground text-sm font-medium underline underline-offset-4"
        >
          {t("auth.signIn")}
        </Link>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (password !== confirmPassword) {
      setError(t("auth.passwordsDoNotMatch"));
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError(t("validation.passwordTooShort"));
      setLoading(false);
      return;
    }

    if (password.length > 128) {
      setError(t("validation.passwordTooLong"));
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(
          data.error === "Invalid or expired token" ? t("auth.invalidResetToken") : data.error,
        );
        setLoading(false);
        return;
      }

      setSuccess(true);
      setLoading(false);
    } catch {
      setError(t("common.errorDescription"));
      setLoading(false);
    }
  }

  return (
    <>
      <h1 className="mb-2 text-center text-[32px] font-bold">{t("auth.resetPasswordTitle")}</h1>
      <p className="text-muted-foreground mb-8 text-center text-sm">
        {t("auth.resetPasswordDescription")}
      </p>

      <form onSubmit={onSubmit} className="space-y-4">
        {error && (
          <div className="bg-destructive/10 text-destructive rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}
        <div className="space-y-1.5">
          <label htmlFor="password" className="text-sm font-medium">
            {t("auth.newPassword")}
          </label>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              className="h-11 pr-10"
              required
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 transition-colors"
              aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="confirmPassword" className="text-sm font-medium">
            {t("auth.confirmPassword")}
          </label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type={showPassword ? "text" : "password"}
            className="h-11"
            required
          />
        </div>
        <Button type="submit" className="h-11 w-full text-base font-semibold" disabled={loading}>
          {loading ? t("auth.resettingPassword") : t("auth.resetPassword")}
        </Button>
      </form>
    </>
  );
}
