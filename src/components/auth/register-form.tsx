"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OAuthButtons } from "./oauth-buttons";
import { registerSchema } from "@/lib/validators";
import { useTranslations } from "@/lib/i18n";

export function RegisterForm() {
  const router = useRouter();
  const { t } = useTranslations();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      password: formData.get("password") as string,
    };

    const parsed = registerSchema.safeParse(data);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `
            mutation Register($input: RegisterInput!) {
              register(input: $input) {
                id
              }
            }
          `,
          variables: {
            input: data,
          },
        }),
      });

      const json = await res.json();

      if (json.errors) {
        setError(json.errors[0].message);
        setLoading(false);
        return;
      }

      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        setError(t("auth.signUpSuccessLoginFailed"));
        setLoading(false);
        return;
      }

      router.push("/onboarding");
      router.refresh();
    } catch {
      setError(t("common.errorDescription"));
      setLoading(false);
    }
  }

  return (
    <>
      <h1 className="mb-8 text-center text-[32px] font-bold">{t("auth.createAccount")}</h1>

      <div className="space-y-3">
        <OAuthButtons />
      </div>

      <div className="relative my-7">
        <div className="absolute inset-0 flex items-center">
          <div className="border-border w-full border-t" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-background text-muted-foreground px-4 text-xs tracking-wider uppercase">
            {t("auth.orContinueWith")}
          </span>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        {error && (
          <div className="bg-destructive/10 text-destructive rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}
        <div className="space-y-1.5">
          <label htmlFor="name" className="text-sm font-medium">
            {t("auth.name")}
          </label>
          <Input
            id="name"
            name="name"
            placeholder={t("auth.namePlaceholder")}
            className="h-11"
            required
          />
        </div>
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
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="password" className="text-sm font-medium">
            {t("auth.password")}
          </label>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder={t("auth.passwordPlaceholder")}
              className="h-11 pr-10"
              required
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
        <Button type="submit" className="h-11 w-full text-base font-semibold" disabled={loading}>
          {loading ? t("auth.creatingAccount") : t("auth.createAccount")}
        </Button>
      </form>

      <p className="text-muted-foreground mt-8 text-center text-sm">
        {t("auth.alreadyHaveAccount")}{" "}
        <Link href="/login" className="text-foreground font-medium underline underline-offset-4">
          {t("auth.signIn")}
        </Link>
      </p>
    </>
  );
}
