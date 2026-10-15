import Link from "next/link";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { getRequestLocale } from "@/lib/i18n/server";
import { NotFoundDebug } from "@/components/layout/not-found-debug";

export default async function AppNotFound() {
  const dict = dictionaries[await getRequestLocale()];

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold">{dict.common.notFoundTitle}</h1>
        <p className="text-muted-foreground mt-2">{dict.common.notFoundDescription}</p>
        <Link
          href="/context"
          className="bg-primary text-primary-foreground mt-4 inline-block rounded-md px-4 py-2 text-sm font-medium"
        >
          {dict.common.notFoundBackHome}
        </Link>
        <div className="mt-4">
          <NotFoundDebug />
        </div>
      </div>
    </div>
  );
}
