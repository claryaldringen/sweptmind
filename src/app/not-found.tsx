import Link from "next/link";
import { cookies } from "next/headers";
import { cs } from "@/lib/i18n/dictionaries/cs";
import { en } from "@/lib/i18n/dictionaries/en";
import type { Locale } from "@/lib/i18n/types";

export default async function RootNotFound() {
  const cookieStore = await cookies();
  const locale = (cookieStore.get("sweptmind-locale")?.value as Locale) || "cs";
  const dict = locale === "en" ? en : cs;

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold">{dict.common.notFoundTitle}</h1>
        <p className="text-muted-foreground mt-2">{dict.common.notFoundDescription}</p>
        <Link
          href="/login"
          className="bg-primary text-primary-foreground mt-4 inline-block rounded-md px-4 py-2 text-sm font-medium"
        >
          {dict.common.notFoundBackHome}
        </Link>
      </div>
    </div>
  );
}
