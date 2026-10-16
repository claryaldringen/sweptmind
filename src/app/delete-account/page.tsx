import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BUSINESS_INFO } from "@/lib/business-info";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { getRequestLocale } from "@/lib/i18n/server";

const CONTACT_EMAIL = "info@sweptmind.com";

export async function generateMetadata(): Promise<Metadata> {
  const t = dictionaries[await getRequestLocale()].deleteAccountPage;
  return { title: t.metaTitle };
}

/**
 * How to delete the account — the public link Google Play requires for apps with sign-up.
 * The deletion itself is in Settings (DeleteAccountSection).
 */
export default async function DeleteAccountPage() {
  const t = dictionaries[await getRequestLocale()].deleteAccountPage;
  const [noAccessBefore, noAccessAfter] = t.noAccessBody.split("{email}");

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href="/"
        className="text-muted-foreground hover:text-foreground mb-8 inline-flex items-center gap-1 text-sm transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        {t.back}
      </Link>

      <h1 className="mb-4 text-3xl font-bold">{t.title}</h1>
      <p className="mb-8 text-sm leading-relaxed">{t.intro}</p>

      <div className="space-y-8 text-sm leading-relaxed">
        <section>
          <h2 className="mb-3 text-xl font-semibold">{t.stepsTitle}</h2>
          <ol className="list-decimal space-y-1 pl-6">
            <li>{t.step1}</li>
            <li>{t.step2}</li>
            <li>{t.step3}</li>
            <li>{t.step4}</li>
          </ol>
          <Button asChild className="mt-4">
            <Link href="/settings#delete-account">{t.signIn}</Link>
          </Button>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">{t.deletedTitle}</h2>
          <p>{t.deletedBody}</p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">{t.keptTitle}</h2>
          <p>{t.keptBody}</p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">{t.noAccessTitle}</h2>
          <p>
            {noAccessBefore}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline">
              {CONTACT_EMAIL}
            </a>
            {noAccessAfter}
          </p>
        </section>

        <p className="text-muted-foreground border-t pt-6 text-xs">
          SweptMind &middot; {BUSINESS_INFO.name}, {BUSINESS_INFO.address} &middot; IČO{" "}
          {BUSINESS_INFO.businessId}
        </p>
      </div>
    </div>
  );
}
