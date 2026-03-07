import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
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
import { cs } from "@/lib/i18n/dictionaries/cs";
import { en } from "@/lib/i18n/dictionaries/en";
import type { Locale } from "@/lib/i18n/types";

export const metadata: Metadata = {
  title: "Getting Things Done (GTD) — SweptMind",
  description:
    "A comprehensive guide to David Allen's Getting Things Done methodology. Learn to capture, organize, and execute tasks effectively.",
};

const content = {
  cs: {
    backHome: "Zpět na hlavní stránku",
    title: "Getting Things Done",
    subtitle: "Kompletní průvodce metodou GTD od Davida Allena",
    introTitle: "Co je GTD?",
    intro: `Getting Things Done (GTD) je metoda osobní produktivity, kterou vyvinul David Allen a popsal ve své knize "Getting Things Done: The Art of Stress-Free Productivity" (2001). Základní myšlenka je jednoduchá: vaše mysl je určena k tomu, aby měla nápady, ne aby je ukládala. Když všechny své závazky, úkoly a nápady přesunete z hlavy do důvěryhodného externího systému, uvolníte mentální kapacitu pro kreativní myšlení a soustředění na aktuální práci.

GTD není jen další to-do list. Je to kompletní systém pro zpracování všech vstupů, které k vám přicházejí — e-maily, nápady, úkoly od kolegů, osobní závazky — a jejich transformaci na konkrétní další kroky.`,

    principlesTitle: "5 základních kroků GTD",

    captureTitle: "1. Zachycení (Capture)",
    captureContent: `První a nejdůležitější krok: zachyťte úplně vše, co vyžaduje vaši pozornost. Každou myšlenku, úkol, nápad, závazek nebo informaci, která se vám honí hlavou, zapište do jednoho místa — vašeho "inboxu".

Inbox může být fyzický (zásuvka na papíry) nebo digitální (aplikace jako SweptMind). Klíčové je:
- Zachytávat okamžitě, jakmile věc vznikne
- Nezhodnocovat ani netřídit během zachytávání
- Mít inbox vždy po ruce (mobilní aplikace je ideální)
- Pravidlo: pokud na něco myslíte víc než 2 minuty, zapište to

Typické vstupy k zachycení:
- "Musím zavolat zubaři"
- "Nápad na nový projekt"
- "Koupit dárek k narozeninám"
- "Odpovědět na email od šéfa"
- "Opravit kapající kohoutek"`,

    clarifyTitle: "2. Ujasnění (Clarify)",
    clarifyContent: `Každý zachycený vstup projděte a položte si klíčovou otázku: "Je to realizovatelné? Mohu s tím něco udělat?"

Pokud NE:
- Smazat (nepotřebné)
- Archivovat jako referenční materiál (možná se to hodí později)
- Přesunout do seznamu "Někdy/Možná" (není to aktuální, ale nechcete to ztratit)

Pokud ANO, další otázka: "Jaký je další konkrétní krok?"
- Pokud to zabere méně než 2 minuty → udělejte to okamžitě (pravidlo 2 minut)
- Pokud to vyžaduje víc kroků → vytvořte projekt
- Pokud to musí udělat někdo jiný → delegujte a sledujte v seznamu "Čekám na"
- Pokud to má konkrétní termín → naplánujte do kalendáře

Důležité: každý úkol musí být formulovaný jako konkrétní fyzický krok. Ne "Narozeniny mámy", ale "Koupit dort u Madame Gâteaux" nebo "Zarezervovat restauraci na sobotu".`,

    organizeTitle: "3. Organizace (Organize)",
    organizeContent: `Roztříděné úkoly umístěte do správných seznamů a kategorií. GTD doporučuje následující strukturu:

Další kroky (Next Actions):
Konkrétní fyzické úkoly, které můžete udělat hned. Toto je váš hlavní pracovní seznam. Každý úkol by měl začínat slovesem: "Zavolat...", "Napsat...", "Koupit...", "Opravit...".

Projekty:
Cokoliv, co vyžaduje více než jeden krok k dokončení. "Zorganizovat narozeninovou oslavu" je projekt se všemi kroky jako objednat dort, pozvat hosty, vyzdobit. Každý projekt musí mít definovaný alespoň jeden další krok.

Čekám na (Waiting For):
Úkoly, které jste delegovali nebo čekáte na odpověď. Zapisujte si datum delegování a od koho čekáte.

Někdy/Možná (Someday/Maybe):
Nápady a projekty, které nechcete dělat teď, ale nechcete je ztratit. "Naučit se španělsky", "Napsat blog", "Navštívit Island". Pravidelně revidujte.

Kalendář:
Pouze věci s pevným datem a časem. GTD striktně rozlišuje mezi "musím 15. března" a "chtěl bych brzy". Do kalendáře patří jen to první.

Referenční materiál:
Informace, které nepotřebují akci, ale mohou se hodit — čísla, poznámky ze schůzek, návody.

Kontextové seznamy:
Kontexty jsou srdcem GTD. Místo toho, abyste přemýšleli "co bych měl dělat?", se podíváte na kontext, ve kterém se právě nacházíte, a ten vám řekne, co dělat můžete. Seskupte úkoly podle kontextu:
- Počítač — "Odeslat fakturaci", "Objednat letenky", "Napsat článek na blog"
- Telefon — "Zavolat zubaři", "Objednat se k lékaři", "Domluvit schůzku s Petrem"
- Doma — "Vysát obývák", "Opravit kapající kohoutek", "Uklidit garáž"
- Obchod — "Koupit mléko a chleba", "Vyzvednout balíček na poště", "Koupit dárek pro mámu"
- Kancelář — "Vytisknout smlouvu", "Promluvit s šéfem o projektu", "Doplnit papíry do tiskárny"
- Venku — "Odnést oblečení do čistírny", "Vyzvednout klíče u správce", "Zaběhat si v parku"

Jak to řešit ve SweptMind:
Ve SweptMind máte dva způsoby, jak kontexty nastavit. Prvním je kontext zařízení — každému seznamu nebo štítku přiřadíte, jestli se vztahuje k počítači, nebo k telefonu. Aplikace automaticky pozná, na jakém zařízení ji otevíráte, a zvýrazní relevantní seznamy žlutě. Druhým způsobem je lokace — seznamu nebo štítku přiřadíte konkrétní místo (třeba "Doma", "Kancelář", "Albert na Andělu"). SweptMind sleduje vaši polohu a seznamy poblíž se zvýrazní zeleně.

Tip: Kontexty můžete přiřazovat i štítkům, nejen seznamům. Štítek "Nákupy" s lokací "Albert" vám zvýrazní všechny úkoly oštítkované jako nákupy, když budete poblíž obchodu.`,

    engageTitle: "4. Vykonání (Engage)",
    engageContent: `Teď, když máte vše organizované, můžete se soustředit na vykonávání. GTD navrhuje 4 kritéria pro výběr dalšího úkolu:

1. Kontext: Kde jste? Co máte k dispozici? Pokud jste u počítače, podívejte se na seznam Počítač. Pokud jste venku, na seznam Venku. SweptMind toto automatizuje skrze funkci "Tady & teď".

2. Dostupný čas: Máte 5 minut nebo hodinu? Vybírejte úkoly, které se vejdou do dostupného času.

3. Dostupná energie: Jste čerství a soustředění, nebo unavení? Náročné úkoly nechte na dobu, kdy máte nejvíc energie.

4. Priorita: Ze zbylých úkolů (filtrovaných podle kontextu, času a energie) vyberte ten nejdůležitější.

Klíčový princip: nedělejte rozhodování o tom CO dělat až v momentě vykonávání. Rozhodování proběhlo v krocích 2 a 3. Teď jen vybíráte a pracujete.

SweptMind jde ještě dál — úkoly, které teď nemůžete udělat, vůbec nevidíte. Budoucí úkoly (s termínem v budoucnosti) jsou automaticky skryté a objeví se až ve chvíli, kdy se stanou aktuálními. Vaše mysl tak není zatěžovaná věcmi, které teď stejně nemůžete ovlivnit. Vidíte jen to, co je na řadě — přesně tak, jak to GTD zamýšlí.`,

    reviewTitle: "5. Revize (Review)",
    reviewContent: `Pravidelná revize je motor GTD. Bez ní se systém rozpadne. David Allen doporučuje:

Denní revize:
- Ráno: podívejte se na kalendář a seznam dalších kroků
- Večer: zapište vše, co se během dne objevilo

Týdenní revize (nejdůležitější rituál GTD):
Každý týden (ideálně v pátek odpoledne nebo o víkendu) projděte CELÝ systém:
1. Vyprázdněte všechny inboxy (email, poznámky, fyzický inbox)
2. Projděte seznam dalších kroků — je aktuální?
3. Projděte všechny projekty — má každý definovaný další krok?
4. Projděte seznam "Čekám na" — je potřeba připomenout?
5. Projděte "Někdy/Možná" — něco se stalo aktuálním?
6. Projděte kalendář (minulý i budoucí týden)
7. Doplňte chybějící úkoly

Týdenní revize typicky trvá 30–60 minut. Je to investice, která se mnohonásobně vrátí v podobě klidu a přehledu.`,

    horizonsTitle: "6 horizontů pozornosti",
    horizonsContent: `GTD definuje 6 úrovní perspektivy, od konkrétních úkolů po životní poslání:

Přízemí: Další kroky
Konkrétní úkoly, které můžete fyzicky udělat. "Zavolat klientovi", "Napsat email".

10 000 stop: Projekty
Výstupy vyžadující více kroků. "Spustit nový web", "Přestěhovat se".

20 000 stop: Oblasti zodpovědnosti
Oblasti života, které spravujete: zdraví, finance, rodina, kariéra, domácnost. Každá oblast generuje projekty.

30 000 stop: 1–2 leté cíle
Co chcete dosáhnout v dohledné budoucnosti? "Povýšení", "Naučit se programovat", "Zhubnout 10 kg".

40 000 stop: 3–5 letá vize
Kde chcete být za 3–5 let? Kariérní směr, životní styl, vzdělávání.

50 000 stop: Smysl a principy
Proč tu jste? Proč děláte to, co děláte? Vaše hodnoty a životní poslání.

Týdenní revize pokrývá převážně přízemí a 10 000 stop. Vyšší horizonty revidujte měsíčně nebo kvartálně.`,

    tipsTitle: "Praktické tipy pro začátek",
    tipsContent: `Jak začít s GTD:

1. Velký "sběr" (Mind Sweep): Vyhraďte si 1–2 hodiny. Zapište úplně vše, co vám koluje hlavou. David Allen doporučuje zachytit minimálně 100 položek. Trvale budete překvapeni, kolik věcí nesete v hlavě.

2. Zpracujte inbox: Projděte každou položku pravidlem "Co je další krok?". Použijte pravidlo 2 minut — cokoliv kratšího, udělejte hned.

3. Nastavte si seznamy: Vytvořte základní seznamy v SweptMind — Další kroky, Čekám na, Někdy/Možná, a kontextové seznamy podle vašich potřeb.

4. Zaveďte týdenní revizi: Naplánujte si pevný čas v kalendáři. Toto je nejdůležitější zvyk celé metody.

5. Buďte trpěliví: Plné osvojení GTD trvá 2–3 měsíce. Začněte jednoduše a postupně přidávejte komplexitu.

Časté chyby:
- Příliš složité úkoly (místo "Zavolat zubaři" psát "Vyřešit zuby") — buďte konkrétní
- Zapomínat na týdenní revizi — bez ní se systém rozpadne
- Mít příliš mnoho seznamů — začínejte jednoduše
- Snažit se být dokonalý — GTD je nástroj, ne cíl sám o sobě`,

    bookTitle: "O knize",
    bookContent: `"Getting Things Done: The Art of Stress-Free Productivity" napsal David Allen a poprvé vyšla v roce 2001. Aktualizované vydání z roku 2015 reflektuje digitální dobu. Kniha se prodala v milionech kopií po celém světě a GTD se stalo jedním z nejrozšířenějších systémů osobní produktivity.

David Allen působil jako konzultant produktivity pro korporace i jednotlivce. Jeho přístup je unikátní tím, že se nesoustředí na stanovení priorit (jako mnoho jiných systémů), ale na kompletní zachycení a organizaci všech vstupů — což vede k "mysli jako voda" (mind like water), stavu klidu a připravenosti.

SweptMind je navržen tak, aby přirozeně podporoval GTD workflow — od rychlého zachycení úkolu přes organizaci do kontextových seznamů až po funkci "Tady & teď", která vám pomáhá soustředit se na to, co můžete dělat právě teď.`,

    ctaTitle: "Začněte s GTD v SweptMind",
  },
  en: {
    backHome: "Back to homepage",
    title: "Getting Things Done",
    subtitle: "A complete guide to David Allen's GTD methodology",
    introTitle: "What is GTD?",
    intro: `Getting Things Done (GTD) is a personal productivity methodology developed by David Allen and described in his book "Getting Things Done: The Art of Stress-Free Productivity" (2001). The fundamental idea is simple: your mind is meant for having ideas, not for holding them. When you move all your commitments, tasks, and ideas from your head into a trusted external system, you free up mental capacity for creative thinking and focusing on the work at hand.

GTD is not just another to-do list. It's a complete system for processing all inputs that come your way — emails, ideas, tasks from colleagues, personal commitments — and transforming them into concrete next actions.`,

    principlesTitle: "The 5 core steps of GTD",

    captureTitle: "1. Capture",
    captureContent: `The first and most important step: capture absolutely everything that requires your attention. Every thought, task, idea, commitment, or piece of information running through your mind goes into one place — your "inbox."

Your inbox can be physical (a paper tray) or digital (an app like SweptMind). The key principles:
- Capture immediately when something comes up
- Don't evaluate or sort during capture
- Have your inbox always at hand (a mobile app is ideal)
- Rule: if you're thinking about something for more than 2 minutes, write it down

Typical inputs to capture:
- "I need to call the dentist"
- "Idea for a new project"
- "Buy a birthday gift"
- "Reply to the boss's email"
- "Fix the leaky faucet"`,

    clarifyTitle: "2. Clarify",
    clarifyContent: `Go through each captured input and ask the key question: "Is this actionable? Can I do something about it?"

If NO:
- Delete it (not needed)
- Archive as reference material (might be useful later)
- Move to "Someday/Maybe" list (not current, but you don't want to lose it)

If YES, next question: "What's the very next physical action?"
- If it takes less than 2 minutes → do it immediately (the 2-minute rule)
- If it requires multiple steps → create a project
- If someone else needs to do it → delegate and track in "Waiting For" list
- If it has a specific deadline → schedule it in your calendar

Important: every task must be formulated as a concrete physical step. Not "Mom's birthday," but "Buy cake at Madame Gateaux" or "Reserve restaurant for Saturday."`,

    organizeTitle: "3. Organize",
    organizeContent: `Place sorted tasks into the right lists and categories. GTD recommends the following structure:

Next Actions:
Concrete physical tasks you can do right now. This is your main working list. Each task should start with a verb: "Call...", "Write...", "Buy...", "Fix...".

Projects:
Anything that requires more than one step to complete. "Organize a birthday party" is a project with steps like order cake, invite guests, decorate. Every project must have at least one defined next action.

Waiting For:
Tasks you've delegated or are waiting for a response on. Note the delegation date and who you're waiting for.

Someday/Maybe:
Ideas and projects you don't want to do now but don't want to lose. "Learn Spanish," "Write a blog," "Visit Iceland." Review regularly.

Calendar:
Only items with a fixed date and time. GTD strictly distinguishes between "must do on March 15" and "would like to do soon." Only the former goes on the calendar.

Reference Material:
Information that doesn't require action but might be useful — numbers, meeting notes, manuals.

Context Lists:
Contexts are the heart of GTD. Instead of thinking "what should I do?", you look at the context you're currently in, and it tells you what you can do. Group tasks by context:
- Computer — "Send invoices", "Book flights", "Write a blog post"
- Phone — "Call the dentist", "Book a doctor's appointment", "Set up a meeting with Peter"
- Home — "Vacuum the living room", "Fix the leaky faucet", "Clean out the garage"
- Errands — "Buy milk and bread", "Pick up package at the post office", "Buy a gift for mom"
- Office — "Print the contract", "Talk to the boss about the project", "Refill printer paper"
- Out — "Drop off clothes at the dry cleaner", "Pick up keys from the landlord", "Go for a run in the park"

How to do this in SweptMind:
SweptMind gives you two ways to set up contexts. The first is device context — assign each list or tag to either computer or phone. The app automatically detects which device you're using and highlights relevant lists in yellow. The second is location — assign a specific place to a list or tag (like "Home", "Office", "Walmart on 5th Ave"). SweptMind tracks your location and highlights nearby lists in green.

Tip: You can assign contexts to tags too, not just lists. A "Shopping" tag with a "Walmart" location will highlight all shopping-tagged tasks when you're near the store.`,

    engageTitle: "4. Engage",
    engageContent: `Now that everything is organized, you can focus on execution. GTD suggests 4 criteria for choosing your next task:

1. Context: Where are you? What do you have available? If you're at a computer, look at the Computer list. If you're out, check Errands. SweptMind automates this through the "Here & Now" feature.

2. Available time: Do you have 5 minutes or an hour? Choose tasks that fit your available time slot.

3. Available energy: Are you fresh and focused, or tired? Save demanding tasks for when you have the most energy.

4. Priority: From the remaining tasks (filtered by context, time, and energy), pick the most important one.

Key principle: don't make decisions about WHAT to do at the moment of execution. That decision was made in steps 2 and 3. Now you just select and work.

SweptMind takes this even further — tasks you can't do right now are hidden entirely. Future tasks (with a due date in the future) are automatically invisible and only appear when they become current. Your mind isn't burdened by things you can't act on anyway. You see only what's up next — exactly as GTD intends.`,

    reviewTitle: "5. Review",
    reviewContent: `Regular review is the engine of GTD. Without it, the system falls apart. David Allen recommends:

Daily review:
- Morning: check your calendar and next actions list
- Evening: capture anything that came up during the day

Weekly review (the most important GTD ritual):
Every week (ideally Friday afternoon or on the weekend) go through your ENTIRE system:
1. Empty all inboxes (email, notes, physical inbox)
2. Review your next actions list — is it current?
3. Review all projects — does each have a defined next action?
4. Review "Waiting For" — do you need to follow up?
5. Review "Someday/Maybe" — has anything become current?
6. Review your calendar (past and upcoming week)
7. Add any missing tasks

A weekly review typically takes 30-60 minutes. It's an investment that pays back many times over in peace of mind and clarity.`,

    horizonsTitle: "The 6 Horizons of Focus",
    horizonsContent: `GTD defines 6 levels of perspective, from concrete tasks to life purpose:

Ground level: Next Actions
Concrete tasks you can physically do. "Call the client," "Write the email."

10,000 feet: Projects
Outcomes requiring multiple steps. "Launch new website," "Move to a new apartment."

20,000 feet: Areas of Responsibility
Life areas you manage: health, finances, family, career, household. Each area generates projects.

30,000 feet: 1-2 year goals
What do you want to achieve in the foreseeable future? "Get promoted," "Learn to code," "Lose 10 kg."

40,000 feet: 3-5 year vision
Where do you want to be in 3-5 years? Career direction, lifestyle, education.

50,000 feet: Purpose and principles
Why are you here? Why do you do what you do? Your values and life mission.

The weekly review primarily covers ground level and 10,000 feet. Review higher horizons monthly or quarterly.`,

    tipsTitle: "Practical tips for getting started",
    tipsContent: `How to start with GTD:

1. The Big "Mind Sweep": Set aside 1-2 hours. Write down absolutely everything on your mind. David Allen recommends capturing at least 100 items. You'll be permanently surprised by how much you carry in your head.

2. Process your inbox: Go through each item with the "What's the next action?" rule. Use the 2-minute rule — anything shorter, do it now.

3. Set up your lists: Create basic lists in SweptMind — Next Actions, Waiting For, Someday/Maybe, and context lists based on your needs.

4. Establish the weekly review: Schedule a fixed time in your calendar. This is the most important habit of the entire method.

5. Be patient: Fully adopting GTD takes 2-3 months. Start simple and gradually add complexity.

Common mistakes:
- Tasks too vague (instead of "Call the dentist" writing "Deal with teeth") — be specific
- Forgetting the weekly review — without it, the system collapses
- Having too many lists — start simple
- Trying to be perfect — GTD is a tool, not a goal in itself`,

    bookTitle: "About the book",
    bookContent: `"Getting Things Done: The Art of Stress-Free Productivity" was written by David Allen and first published in 2001. The updated 2015 edition reflects the digital age. The book has sold millions of copies worldwide and GTD has become one of the most widely adopted personal productivity systems.

David Allen worked as a productivity consultant for corporations and individuals. His approach is unique in that it doesn't focus on setting priorities (like many other systems), but on completely capturing and organizing all inputs — which leads to "mind like water," a state of calm and readiness.

SweptMind is designed to naturally support the GTD workflow — from quick task capture through organization into context lists to the "Here & Now" feature that helps you focus on what you can do right now.`,

    ctaTitle: "Start using GTD with SweptMind",
  },
};

export default async function GtdPage() {
  const cookieStore = await cookies();
  const locale = (cookieStore.get("sweptmind-locale")?.value as Locale) || "cs";
  const dictionaries = { cs, en };
  const t = dictionaries[locale];
  const c = content[locale];

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
            const lines = paragraph.split("\n");
            const intro = lines[0].startsWith("- ") ? null : lines[0];
            const items = lines.filter((l) => l.startsWith("- "));
            return (
              <div key={i}>
                {intro && <p>{intro}</p>}
                <ul className="mt-2 list-inside list-disc space-y-1 pl-2">
                  {items.map((item, j) => (
                    <li key={j}>{item.slice(2)}</li>
                  ))}
                </ul>
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

const hiddenTasksContent = {
  cs: {
    title: "Příklad: Skryté budoucí úkoly",
    desc: "Vidíte jen to, co je aktuální. Budoucí úkoly jsou schované a objeví se automaticky.",
    visibleTasks: [
      { title: "Zavolat zubaři" },
      { title: "Koupit mléko" },
      { title: "Odeslat fakturaci" },
    ],
    futureLabel: "Budoucí",
    futureTasks: [
      { title: "Připravit prezentaci", date: "15. bře" },
      { title: "Obnovit řidičák", date: "22. bře" },
      { title: "Narozeniny mámy — koupit dárek", date: "5. dub" },
    ],
    listName: "Úkoly",
  },
  en: {
    title: "Example: Hidden future tasks",
    desc: "You only see what's current. Future tasks are hidden and appear automatically.",
    visibleTasks: [
      { title: "Call the dentist" },
      { title: "Buy milk" },
      { title: "Send invoices" },
    ],
    futureLabel: "Future",
    futureTasks: [
      { title: "Prepare presentation", date: "Mar 15" },
      { title: "Renew driver's license", date: "Mar 22" },
      { title: "Mom's birthday — buy a gift", date: "Apr 5" },
    ],
    listName: "Tasks",
  },
};

const contextExampleContent = {
  cs: {
    title: "Příklad: Jak kontexty fungují ve SweptMind",
    step1Title: "Vytvořte seznam s lokací",
    step1Desc: 'Vytvořte seznam "Doma" a přiřaďte mu lokaci vašeho bydliště.',
    step2Title: "Vytvořte seznam s kontextem zařízení",
    step2Desc: 'Vytvořte seznam "U počítače" s kontextem zařízení "počítač".',
    step3Title: '"Tady & teď" sloučí oba kontexty',
    step3Desc:
      "Když přijdete domů a otevřete SweptMind na počítači, uvidíte úkoly z obou seznamů najednou. Nemusíte procházet jednotlivé seznamy — aplikace to udělá za vás.",
    homeTasks: ["Vysát obývák", "Zalít květiny", "Opravit kohoutek"],
    computerTasks: ["Odeslat fakturaci", "Objednat letenky"],
    nearby: "Poblíž",
    deviceMatch: "Váš počítač",
  },
  en: {
    title: "Example: How contexts work in SweptMind",
    step1Title: "Create a list with a location",
    step1Desc: 'Create a list called "Home" and assign it your home address.',
    step2Title: "Create a list with a device context",
    step2Desc: 'Create a list called "At Computer" with the device context set to "computer."',
    step3Title: '"Here & Now" merges both contexts',
    step3Desc:
      "When you come home and open SweptMind on your computer, you see tasks from both lists at once. No need to browse individual lists — the app does it for you.",
    homeTasks: ["Vacuum the living room", "Water the plants", "Fix the faucet"],
    computerTasks: ["Send invoices", "Book flights"],
    nearby: "Nearby",
    deviceMatch: "Your computer",
  },
};

function ContextExampleSteps({ locale }: { locale: Locale }) {
  const t = contextExampleContent[locale];

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
                <span className="text-foreground truncate">
                  {locale === "cs" ? "Doma" : "Home"}
                </span>
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
                <span className="text-foreground truncate">
                  {locale === "cs" ? "U počítače" : "At Computer"}
                </span>
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
            <span className="text-foreground text-2xl font-bold">
              {locale === "cs" ? "Tady & teď" : "Here & Now"}
            </span>
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
                    <span className="text-muted-foreground">
                      {locale === "cs" ? "Doma" : "Home"}
                    </span>
                    <span className="text-muted-foreground">·</span>
                    <span className="flex items-center gap-0.5 text-green-500">
                      <MapPin className="h-3 w-3 animate-pulse" />
                      {locale === "cs" ? "Doma" : "Home"}
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
                    <span className="text-muted-foreground">
                      {locale === "cs" ? "U počítače" : "At Computer"}
                    </span>
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
  const t = hiddenTasksContent[locale];

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
