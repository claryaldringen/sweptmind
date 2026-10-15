import type { GtdContent } from "./types";

export const cs: GtdContent = {
  page: {
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
  hiddenTasks: {
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
  contextExample: {
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
    homeList: "Doma",
    computerList: "U počítače",
    hereAndNow: "Tady & teď",
  },
};
