import type { Metadata } from "next";
import Link from "next/link";
import {
  CheckCircle2,
  ArrowLeft,
  CalendarDays,
  MapPin,
  Monitor,
  Zap,
  List,
  ArrowDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { dictionaries } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { getRequestLocale } from "@/lib/i18n/server";
import { gtdContent } from "./content";

export const metadata: Metadata = {
  title: "Getting Things Done (GTD) — SweptMind",
  description:
    "A comprehensive guide to David Allen's Getting Things Done methodology. Learn to capture, organize, and execute tasks effectively.",
};

export default async function GtdPage() {
  const locale = await getRequestLocale();
  const t = dictionaries[locale];
  const c = gtdContent[locale].page;

  return (
    <div className="bg-background text-foreground min-h-screen">
      {/* Header */}
      <header className="border-border/50 border-b px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-sm font-medium">SweptMind</span>
          </Link>
          <Button asChild variant="ghost" size="sm">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {c.backHome}
            </Link>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden px-6 py-20 sm:py-28">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 -right-32 h-[400px] w-[400px] rounded-full bg-emerald-400/10 blur-3xl dark:bg-emerald-500/8" />
          <div className="absolute -bottom-32 -left-32 h-[400px] w-[400px] rounded-full bg-violet-400/10 blur-3xl dark:bg-violet-500/8" />
        </div>
        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <p className="mb-3 text-sm font-semibold tracking-widest text-emerald-600 uppercase dark:text-emerald-400">
            David Allen
          </p>
          <h1 className="text-foreground mb-4 text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            {c.title}
          </h1>
          <p className="text-muted-foreground mx-auto max-w-2xl text-lg leading-relaxed sm:text-xl">
            {c.subtitle}
          </p>
        </div>
      </section>

      {/* Content */}
      <article className="px-6 pb-24">
        <div className="mx-auto max-w-3xl space-y-16">
          {/* Intro */}
          <Section title={c.introTitle}>{c.intro}</Section>

          {/* 5 Steps */}
          <div>
            <h2 className="text-foreground mb-8 text-center text-3xl font-bold tracking-tight">
              {c.principlesTitle}
            </h2>
            <div className="space-y-12">
              <NumberedSection number="1" color="emerald" title={c.captureTitle}>
                {c.captureContent}
              </NumberedSection>
              <NumberedSection number="2" color="violet" title={c.clarifyTitle}>
                {c.clarifyContent}
              </NumberedSection>
              <NumberedSection number="3" color="blue" title={c.organizeTitle}>
                {c.organizeContent}
              </NumberedSection>
              <ContextExampleSteps locale={locale} />
              <NumberedSection number="4" color="amber" title={c.engageTitle}>
                {c.engageContent}
              </NumberedSection>
              <HiddenTasksExample locale={locale} />
              <NumberedSection number="5" color="rose" title={c.reviewTitle}>
                {c.reviewContent}
              </NumberedSection>
            </div>
          </div>

          {/* Horizons */}
          <Section title={c.horizonsTitle}>{c.horizonsContent}</Section>

          {/* Tips */}
          <Section title={c.tipsTitle}>{c.tipsContent}</Section>

          {/* Book */}
          <Section title={c.bookTitle}>{c.bookContent}</Section>

          {/* CTA */}
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 px-8 py-12 text-center dark:border-emerald-800/50 dark:bg-emerald-950/20">
            <h2 className="text-foreground mb-6 text-2xl font-bold">{c.ctaTitle}</h2>
            <div className="flex flex-col justify-center gap-3 sm:flex-row sm:gap-4">
              <Button
                asChild
                size="lg"
                className="bg-emerald-600 px-8 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:text-black dark:hover:bg-emerald-400"
              >
                <Link href="/register">{t.landing.getStarted}</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="px-8">
                <Link href="/login">{t.landing.signIn}</Link>
              </Button>
            </div>
          </div>
        </div>
      </article>

      {/* Footer */}
      <footer className="border-border/50 border-t px-6 py-8">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-sm font-medium">SweptMind</span>
          </div>
          <div className="text-muted-foreground text-sm">
            &copy; {new Date().getFullYear()} SweptMind
          </div>
        </div>
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: string }) {
  return (
    <section>
      <h2 className="text-foreground mb-4 text-2xl font-bold tracking-tight">{title}</h2>
      <div className="text-muted-foreground space-y-4 leading-relaxed">
        {children.split("\n\n").map((paragraph, i) => {
          if (paragraph.startsWith("- ")) {
            const items = paragraph.split("\n").filter((l) => l.startsWith("- "));
            return (
              <ul key={i} className="list-inside list-disc space-y-1 pl-2">
                {items.map((item, j) => (
                  <li key={j}>{item.slice(2)}</li>
                ))}
              </ul>
            );
          }
          return <p key={i}>{paragraph}</p>;
        })}
      </div>
    </section>
  );
}

const sectionColors = {
  emerald: "bg-emerald-600 dark:bg-emerald-500",
  violet: "bg-violet-600 dark:bg-violet-500",
  blue: "bg-blue-600 dark:bg-blue-500",
  amber: "bg-amber-600 dark:bg-amber-500",
  rose: "bg-rose-600 dark:bg-rose-500",
} as const;

function NumberedSection({
  number,
  color,
  title,
  children,
}: {
  number: string;
  color: keyof typeof sectionColors;
  title: string;
  children: string;
}) {
  return (
    <section className="border-border/50 rounded-xl border p-6 sm:p-8">
      <div className="mb-4 flex items-center gap-3">
        <span
          className={`${sectionColors[color]} flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white dark:text-black`}
        >
          {number}
        </span>
        <h3 className="text-foreground text-xl font-semibold">{title}</h3>
      </div>
      <div className="text-muted-foreground space-y-4 leading-relaxed">
        {children.split("\n\n").map((paragraph, i) => {
          if (paragraph.startsWith("- ") || paragraph.includes("\n- ")) {
            // Text lines and runs of bullets, in their original order
            const blocks: { items: string[] | null; text: string }[] = [];
            for (const line of paragraph.split("\n")) {
              const last = blocks[blocks.length - 1];
              if (!line.startsWith("- ")) blocks.push({ items: null, text: line });
              else if (last?.items) last.items.push(line.slice(2));
              else blocks.push({ items: [line.slice(2)], text: "" });
            }
            return (
              <div key={i} className="space-y-2">
                {blocks.map((block, j) =>
                  block.items ? (
                    <ul key={j} className="list-inside list-disc space-y-1 pl-2">
                      {block.items.map((item, k) => (
                        <li key={k}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p
                      key={j}
                      className={
                        block.text.endsWith(":") && block.text.length < 60
                          ? "text-foreground font-medium"
                          : undefined
                      }
                    >
                      {block.text}
                    </p>
                  ),
                )}
              </div>
            );
          }
          if (
            paragraph.includes(":\n") ||
            (paragraph.includes(":") && paragraph.split("\n").length > 2)
          ) {
            const lines = paragraph.split("\n");
            return (
              <div key={i}>
                {lines.map((line, j) => {
                  if (line.endsWith(":") || (line.includes(":") && line.length < 60)) {
                    return (
                      <p key={j} className="text-foreground mt-3 font-medium first:mt-0">
                        {line}
                      </p>
                    );
                  }
                  return <p key={j}>{line}</p>;
                })}
              </div>
            );
          }
          return <p key={i}>{paragraph}</p>;
        })}
      </div>
    </section>
  );
}

function ContextExampleSteps({ locale }: { locale: Locale }) {
  const t = gtdContent[locale].contextExample;

  return (
    <div className="space-y-6">
      <h3 className="text-foreground text-center text-lg font-semibold">{t.title}</h3>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Step 1: List with location */}
        <div className="border-border/50 rounded-xl border p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white dark:bg-blue-500 dark:text-black">
              1
            </span>
            <span className="text-foreground text-sm font-medium">{t.step1Title}</span>
          </div>
          <div className="bg-sidebar overflow-hidden rounded-lg border">
            {/* Sidebar item */}
            <div className="flex items-center justify-between gap-3 rounded-md bg-emerald-50 px-3 py-2 text-sm font-medium dark:bg-emerald-950/30">
              <div className="flex items-center gap-3">
                <List className="h-5 w-5 text-blue-500" />
                <span className="text-foreground truncate">{t.homeList}</span>
                <MapPin className="h-3 w-3 animate-pulse text-green-500" />
              </div>
              <span className="text-muted-foreground text-xs">{t.homeTasks.length}</span>
            </div>
            {/* Task items */}
            <div className="space-y-0.5 pt-1">
              {t.homeTasks.map((task, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 bg-emerald-50 px-4 py-2.5 dark:bg-emerald-950/30"
                >
                  <div className="border-muted-foreground/40 h-4 w-4 shrink-0 rounded-full border" />
                  <span className="text-foreground text-sm">{task}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="text-muted-foreground mt-2 text-xs">{t.step1Desc}</p>
        </div>

        {/* Step 2: List with device context */}
        <div className="border-border/50 rounded-xl border p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white dark:bg-blue-500 dark:text-black">
              2
            </span>
            <span className="text-foreground text-sm font-medium">{t.step2Title}</span>
          </div>
          <div className="bg-sidebar overflow-hidden rounded-lg border">
            {/* Sidebar item */}
            <div className="flex items-center justify-between gap-3 rounded-md bg-yellow-50 px-3 py-2 text-sm font-medium dark:bg-yellow-950/30">
              <div className="flex items-center gap-3">
                <List className="h-5 w-5 text-blue-500" />
                <span className="text-foreground truncate">{t.computerList}</span>
                <Monitor className="h-3 w-3 animate-pulse text-yellow-500" />
              </div>
              <span className="text-muted-foreground text-xs">{t.computerTasks.length}</span>
            </div>
            {/* Task items */}
            <div className="space-y-0.5 pt-1">
              {t.computerTasks.map((task, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 bg-yellow-50 px-4 py-2.5 dark:bg-yellow-950/30"
                >
                  <div className="border-muted-foreground/40 h-4 w-4 shrink-0 rounded-full border" />
                  <span className="text-foreground text-sm">{task}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="text-muted-foreground mt-2 text-xs">{t.step2Desc}</p>
        </div>
      </div>

      {/* Arrow */}
      <div className="flex justify-center">
        <ArrowDown className="text-muted-foreground h-6 w-6" />
      </div>

      {/* Step 3: Merged "Here & Now" view */}
      <div className="border-border/50 rounded-xl border p-5">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white dark:bg-blue-500 dark:text-black">
            3
          </span>
          <span className="text-foreground text-sm font-medium">{t.step3Title}</span>
        </div>
        <div className="bg-sidebar overflow-hidden rounded-lg border">
          {/* Page header */}
          <div className="flex items-center gap-2 px-6 pt-6 pb-3">
            <Zap className="h-7 w-7 text-yellow-500" />
            <span className="text-foreground text-2xl font-bold">{t.hereAndNow}</span>
          </div>
          {/* Task items */}
          <div className="space-y-0.5">
            {t.homeTasks.map((task, i) => (
              <div
                key={`home-${i}`}
                className="flex items-center gap-3 rounded-md bg-emerald-50 px-4 py-2.5 dark:bg-emerald-950/30"
              >
                <div className="border-muted-foreground/40 h-4 w-4 shrink-0 rounded-full border" />
                <div className="min-w-0 flex-1">
                  <span className="text-foreground text-sm">{task}</span>
                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-muted-foreground">{t.homeList}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="flex items-center gap-0.5 text-green-500">
                      <MapPin className="h-3 w-3 animate-pulse" />
                      {t.homeList}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {t.computerTasks.map((task, i) => (
              <div
                key={`computer-${i}`}
                className="flex items-center gap-3 rounded-md bg-yellow-50 px-4 py-2.5 dark:bg-yellow-950/30"
              >
                <div className="border-muted-foreground/40 h-4 w-4 shrink-0 rounded-full border" />
                <div className="min-w-0 flex-1">
                  <span className="text-foreground text-sm">{task}</span>
                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-muted-foreground">{t.computerList}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="flex items-center gap-0.5 text-yellow-500">
                      <Monitor className="h-3 w-3 animate-pulse" />
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {/* Legend */}
          <div className="text-muted-foreground flex items-center gap-3 px-4 py-3 text-xs">
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3 text-green-500" />
              {t.nearby}
            </span>
            <span className="flex items-center gap-1">
              <Monitor className="h-3 w-3 text-yellow-500" />
              {t.deviceMatch}
            </span>
          </div>
        </div>
        <p className="text-muted-foreground mt-2 text-xs">{t.step3Desc}</p>
      </div>
    </div>
  );
}

function HiddenTasksExample({ locale }: { locale: Locale }) {
  const t = gtdContent[locale].hiddenTasks;

  return (
    <div className="space-y-4">
      <h3 className="text-foreground text-center text-lg font-semibold">{t.title}</h3>
      <p className="text-muted-foreground text-center text-sm">{t.desc}</p>

      <div className="border-border/50 mx-auto max-w-md rounded-xl border p-5">
        <div className="bg-sidebar overflow-hidden rounded-lg border">
          {/* Page header — matches list page */}
          <div className="flex items-center gap-2 px-6 pt-6 pb-3">
            <List className="h-7 w-7 text-blue-500" />
            <span className="text-foreground text-2xl font-bold">{t.listName}</span>
          </div>
          {/* Active task items */}
          <div className="space-y-0.5">
            {t.visibleTasks.map((task, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                <div className="border-muted-foreground/40 h-4 w-4 shrink-0 rounded-full border" />
                <span className="text-foreground text-sm">{task.title}</span>
              </div>
            ))}
          </div>
          {/* Future section — collapsed, matches TaskList exactly */}
          <div className="mt-4 pb-2">
            <div className="text-muted-foreground flex w-full items-center gap-1 px-4 py-2 text-xs font-medium">
              <ChevronRight className="h-3.5 w-3.5" />
              {t.futureLabel} ({t.futureTasks.length})
            </div>
            {/* Expanded preview — dimmed to show they're normally hidden */}
            <div className="space-y-0.5 opacity-40">
              {t.futureTasks.map((task, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="border-muted-foreground/30 h-4 w-4 shrink-0 rounded-full border" />
                  <div className="min-w-0 flex-1">
                    <span className="text-foreground text-sm">{task.title}</span>
                    <div className="flex items-center gap-0.5 text-xs">
                      <CalendarDays className="text-muted-foreground h-3 w-3" />
                      <span className="text-muted-foreground">{task.date}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
