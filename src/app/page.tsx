import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Inbox,
  FolderOpen,
  Zap,
  ListTodo,
  Calendar,
  Repeat,
  MapPin,
  Tag,
  Layers,
  ArrowRight,
} from "lucide-react";
import { cs } from "@/lib/i18n/dictionaries/cs";
import { en } from "@/lib/i18n/dictionaries/en";
import type { Dictionary, Locale } from "@/lib/i18n/types";

export const metadata: Metadata = {
  title: "SweptMind — GTD Task Management",
  description:
    "Organize your tasks the GTD way. Capture, clarify, organize and get things done with SweptMind.",
  openGraph: {
    title: "SweptMind — GTD Task Management",
    description:
      "Organize your tasks the GTD way. Capture, clarify, organize and get things done with SweptMind.",
  },
};

const dictionaries: Record<Locale, Dictionary> = { cs, en };

export default async function HomePage() {
  const session = await auth();
  if (session?.user) {
    redirect("/planned");
  }

  const cookieStore = await cookies();
  const locale = (cookieStore.get("sweptmind-locale")?.value as Locale) || "cs";
  const t = dictionaries[locale];

  const currentYear = new Date().getFullYear();

  return (
    <div className="bg-background text-foreground min-h-screen">
      {/* Main content */}
      <main>
        {/* Hero */}
        <section className="relative flex min-h-[90vh] flex-col items-center justify-center overflow-hidden px-6 py-24">
          {/* Colorful background blobs */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-32 -right-32 h-[500px] w-[500px] rounded-full bg-emerald-400/15 blur-3xl dark:bg-emerald-500/10" />
            <div className="absolute top-1/2 -left-48 h-[400px] w-[400px] rounded-full bg-violet-400/15 blur-3xl dark:bg-violet-500/10" />
            <div className="absolute right-1/4 -bottom-24 h-[350px] w-[350px] rounded-full bg-amber-400/15 blur-3xl dark:bg-amber-500/10" />
          </div>

          <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center gap-8 text-center 2xl:max-w-5xl">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-10 w-10 text-emerald-600 2xl:h-12 2xl:w-12 dark:text-emerald-400" />
              <span className="text-muted-foreground text-lg font-medium tracking-wide 2xl:text-xl">
                SweptMind
              </span>
            </div>

            <h1 className="text-foreground text-5xl leading-[1.1] font-bold tracking-tight sm:text-6xl md:text-7xl 2xl:text-8xl">
              {t.landing.heroHeadline.split("\n").map((line, i) => (
                <span
                  key={i}
                  className={
                    i > 0
                      ? "block bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent dark:from-emerald-400 dark:to-teal-300"
                      : ""
                  }
                >
                  {line}
                </span>
              ))}
            </h1>

            <p className="text-muted-foreground max-w-xl text-lg leading-relaxed sm:text-xl 2xl:max-w-2xl 2xl:text-2xl">
              {t.landing.heroDescription}
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
              <Button
                asChild
                size="lg"
                className="bg-emerald-600 px-8 text-base text-white hover:bg-emerald-700 2xl:px-10 2xl:text-lg dark:bg-emerald-500 dark:text-black dark:hover:bg-emerald-400"
              >
                <Link href="/register">{t.landing.getStarted}</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="px-8 text-base 2xl:px-10 2xl:text-lg"
              >
                <Link href="/login">{t.landing.signIn}</Link>
              </Button>
            </div>
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
            <div className="h-10 w-6 rounded-full border-2 border-emerald-600/30 dark:border-emerald-400/30">
              <div className="mx-auto mt-2 h-2 w-1 animate-bounce rounded-full bg-emerald-600/60 dark:bg-emerald-400/60" />
            </div>
          </div>
        </section>

        {/* App Screenshot */}
        <section className="px-6 py-16 sm:py-24 2xl:py-32">
          <div className="mx-auto max-w-4xl 2xl:max-w-5xl">
            <div className="overflow-hidden rounded-xl border border-neutral-200 shadow-2xl dark:border-neutral-700">
              {/* Browser chrome */}
              <div className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-100 px-4 py-2.5 dark:border-neutral-700 dark:bg-neutral-800">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-red-400" />
                  <div className="h-3 w-3 rounded-full bg-amber-400" />
                  <div className="h-3 w-3 rounded-full bg-emerald-400" />
                </div>
                <div className="mx-auto flex-1">
                  <div className="mx-auto max-w-xs rounded-md bg-white px-3 py-1 text-center text-xs text-neutral-400 dark:bg-neutral-900 dark:text-neutral-500">
                    app.sweptmind.com
                  </div>
                </div>
              </div>
              {/* Screenshot */}
              <Image
                src="/screenshot-app.png"
                alt="SweptMind app — GTD task management"
                className="block w-full"
                width={1920}
                height={1080}
                priority={false}
              />
            </div>
          </div>
        </section>

        {/* GTD Section */}
        <section className="border-border/50 border-t px-6 py-24 sm:py-32 2xl:py-40">
          <div className="mx-auto max-w-5xl 2xl:max-w-6xl">
            <div className="mx-auto mb-16 max-w-2xl text-center 2xl:max-w-3xl">
              <p className="mb-3 text-sm font-semibold tracking-widest text-emerald-600 uppercase 2xl:text-base dark:text-emerald-400">
                Getting Things Done
              </p>
              <h2 className="text-foreground mb-4 text-3xl font-bold tracking-tight sm:text-4xl 2xl:text-5xl">
                {t.landing.gtdSectionTitle}
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed 2xl:text-xl">
                {t.landing.gtdSectionSubtitle}
              </p>
            </div>

            <div className="mb-16 flex justify-center">
              <Button
                asChild
                variant="outline"
                size="lg"
                className="px-8 text-base 2xl:px-10 2xl:text-lg"
              >
                <Link href="/gtd">
                  {t.landing.gtdMethodLink}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>

            <div className="grid gap-8 sm:grid-cols-3 sm:gap-6 lg:gap-12 2xl:gap-16">
              <GtdStep
                number="1"
                icon={<Inbox className="h-6 w-6 2xl:h-7 2xl:w-7" />}
                name={t.landing.gtdCaptureName}
                description={t.landing.gtdCaptureDesc}
                color="emerald"
              />
              <GtdStep
                number="2"
                icon={<FolderOpen className="h-6 w-6 2xl:h-7 2xl:w-7" />}
                name={t.landing.gtdOrganizeName}
                description={t.landing.gtdOrganizeDesc}
                color="violet"
              />
              <GtdStep
                number="3"
                icon={<Zap className="h-6 w-6 2xl:h-7 2xl:w-7" />}
                name={t.landing.gtdExecuteName}
                description={t.landing.gtdExecuteDesc}
                color="amber"
              />
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="bg-muted/40 px-6 py-24 sm:py-32 2xl:py-40">
          <div className="mx-auto max-w-5xl 2xl:max-w-6xl">
            <div className="mx-auto mb-16 max-w-2xl text-center 2xl:max-w-3xl">
              <h2 className="text-foreground mb-4 text-3xl font-bold tracking-tight sm:text-4xl 2xl:text-5xl">
                {t.landing.featuresSectionTitle}
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed 2xl:text-xl">
                {t.landing.featuresSectionSubtitle}
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 2xl:gap-8">
              <FeatureCard
                icon={<ListTodo className="h-5 w-5 2xl:h-6 2xl:w-6" />}
                name={t.landing.featureListsName}
                description={t.landing.featureListsDesc}
                color="emerald"
              />
              <FeatureCard
                icon={<Calendar className="h-5 w-5 2xl:h-6 2xl:w-6" />}
                name={t.landing.featurePlanningName}
                description={t.landing.featurePlanningDesc}
                color="blue"
              />
              <FeatureCard
                icon={<Repeat className="h-5 w-5 2xl:h-6 2xl:w-6" />}
                name={t.landing.featureRecurrenceName}
                description={t.landing.featureRecurrenceDesc}
                color="violet"
              />
              <FeatureCard
                icon={<MapPin className="h-5 w-5 2xl:h-6 2xl:w-6" />}
                name={t.landing.featureLocationName}
                description={t.landing.featureLocationDesc}
                color="rose"
              />
              <FeatureCard
                icon={<Tag className="h-5 w-5 2xl:h-6 2xl:w-6" />}
                name={t.landing.featureTagsName}
                description={t.landing.featureTagsDesc}
                color="amber"
              />
              <FeatureCard
                icon={<Layers className="h-5 w-5 2xl:h-6 2xl:w-6" />}
                name={t.landing.featureContextName}
                description={t.landing.featureContextDesc}
                color="teal"
              />
            </div>
          </div>
        </section>

        {/* Footer CTA */}
        <section className="relative overflow-hidden px-6 py-24 sm:py-32 2xl:py-40">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute top-1/2 left-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400/10 blur-3xl dark:bg-emerald-500/8" />
          </div>
          <div className="relative z-10 mx-auto flex max-w-2xl flex-col items-center gap-8 text-center 2xl:max-w-3xl">
            <h2 className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl 2xl:text-5xl">
              {t.landing.ctaHeadline}
            </h2>
            <Button
              asChild
              size="lg"
              className="bg-emerald-600 px-8 text-base text-white hover:bg-emerald-700 2xl:px-10 2xl:text-lg dark:bg-emerald-500 dark:text-black dark:hover:bg-emerald-400"
            >
              <Link href="/register">
                {t.landing.ctaButton}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <p className="text-muted-foreground text-sm 2xl:text-base">
              {t.landing.ctaSignIn}{" "}
              <Link
                href="/login"
                className="text-foreground underline underline-offset-4 transition-colors hover:no-underline"
              >
                {t.landing.signIn}
              </Link>
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-border/50 border-t px-6 py-8 2xl:py-10">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 sm:flex-row sm:justify-between 2xl:max-w-6xl">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-sm font-medium">SweptMind</span>
          </div>
          <div className="text-muted-foreground flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm 2xl:text-base">
            <span>{t.landing.footerMadeWith}</span>
            <span className="hidden sm:inline" aria-hidden="true">
              &middot;
            </span>
            <span>
              &copy; {currentYear} SweptMind. {t.landing.footerRights}
            </span>
          </div>
          <div className="text-muted-foreground flex gap-4 text-sm 2xl:text-base">
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              {t.landing.footerPrivacy}
            </Link>
            <Link
              href="mailto:info@sweptmind.com"
              className="hover:text-foreground transition-colors"
            >
              {t.landing.footerContact}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

const colorMap = {
  emerald: {
    bg: "bg-emerald-600 dark:bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
    iconBg: "bg-emerald-100 dark:bg-emerald-900/40",
  },
  violet: {
    bg: "bg-violet-600 dark:bg-violet-500",
    text: "text-violet-600 dark:text-violet-400",
    iconBg: "bg-violet-100 dark:bg-violet-900/40",
  },
  amber: {
    bg: "bg-amber-600 dark:bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
    iconBg: "bg-amber-100 dark:bg-amber-900/40",
  },
  blue: {
    bg: "bg-blue-600 dark:bg-blue-500",
    text: "text-blue-600 dark:text-blue-400",
    iconBg: "bg-blue-100 dark:bg-blue-900/40",
  },
  rose: {
    bg: "bg-rose-600 dark:bg-rose-500",
    text: "text-rose-600 dark:text-rose-400",
    iconBg: "bg-rose-100 dark:bg-rose-900/40",
  },
  teal: {
    bg: "bg-teal-600 dark:bg-teal-500",
    text: "text-teal-600 dark:text-teal-400",
    iconBg: "bg-teal-100 dark:bg-teal-900/40",
  },
} as const;

type ColorKey = keyof typeof colorMap;

function GtdStep({
  number,
  icon,
  name,
  description,
  color,
}: {
  number: string;
  icon: React.ReactNode;
  name: string;
  description: string;
  color: ColorKey;
}) {
  const c = colorMap[color];
  return (
    <div className="flex flex-col items-center text-center sm:items-start sm:text-left">
      <div className="mb-4 flex items-center gap-3">
        <span
          className={`${c.bg} flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white 2xl:h-10 2xl:w-10 2xl:text-base dark:text-black`}
        >
          {number}
        </span>
        <div className={c.text}>{icon}</div>
      </div>
      <h3 className="text-foreground mb-2 text-xl font-semibold 2xl:text-2xl">{name}</h3>
      <p className="text-muted-foreground leading-relaxed 2xl:text-lg">{description}</p>
    </div>
  );
}

function FeatureCard({
  icon,
  name,
  description,
  color,
}: {
  icon: React.ReactNode;
  name: string;
  description: string;
  color: ColorKey;
}) {
  const c = colorMap[color];
  return (
    <div className="bg-card border-border/50 rounded-xl border p-6 transition-shadow hover:shadow-md 2xl:p-8">
      <div
        className={`${c.iconBg} ${c.text} mb-4 flex h-10 w-10 items-center justify-center rounded-lg 2xl:h-12 2xl:w-12`}
      >
        {icon}
      </div>
      <h3 className="text-foreground mb-2 text-lg font-semibold 2xl:text-xl">{name}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed 2xl:text-base">{description}</p>
    </div>
  );
}
