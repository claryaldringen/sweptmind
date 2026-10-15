import type { Metadata } from "next";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { getRequestLocale } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = dictionaries[await getRequestLocale()];
  return { title: t.pages.planned, description: t.pages.plannedDescription };
}

export default function PlannedLayout({ children }: { children: React.ReactNode }) {
  return children;
}
