import type { GtdContent } from "./types";

export const de: GtdContent = {
  page: {
    backHome: "Zurück zur Startseite",
    title: "Getting Things Done",
    subtitle: "Ein umfassender Leitfaden zur GTD-Methode von David Allen",
    introTitle: "Was ist GTD?",
    intro: `Getting Things Done (GTD) ist eine Methode für persönliche Produktivität, die David Allen entwickelt und in seinem Buch „Getting Things Done: The Art of Stress-Free Productivity“ (2001) beschrieben hat. Die Grundidee ist einfach: Dein Kopf ist dazu da, Ideen zu haben, nicht, sie aufzubewahren. Wenn du all deine Verpflichtungen, Aufgaben und Ideen aus dem Kopf in ein vertrauenswürdiges externes System überträgst, gewinnst du geistige Kapazität für kreatives Denken und für die Konzentration auf die aktuelle Arbeit.

GTD ist nicht einfach nur eine weitere To-do-Liste. Es ist ein vollständiges System, um alle Eingänge zu verarbeiten, die auf dich zukommen – E-Mails, Ideen, Aufgaben von Kollegen, persönliche Verpflichtungen – und sie in konkrete nächste Schritte zu verwandeln.`,

    principlesTitle: "Die 5 Grundschritte von GTD",

    captureTitle: "1. Erfassen (Capture)",
    captureContent: `Der erste und wichtigste Schritt: Erfasse wirklich alles, was deine Aufmerksamkeit verlangt. Jeden Gedanken, jede Aufgabe, Idee, Verpflichtung oder Information, die dir durch den Kopf geht, hältst du an einem einzigen Ort fest – in deinem „Eingangskorb“ (Inbox).

Dein Eingangskorb kann physisch sein (eine Ablage für Papiere) oder digital (eine App wie SweptMind). Die wichtigsten Grundsätze:
- Sofort erfassen, sobald etwas auftaucht
- Beim Erfassen nicht bewerten oder sortieren
- Den Eingangskorb immer griffbereit haben (eine mobile App ist ideal)
- Regel: Wenn du länger als 2 Minuten über etwas nachdenkst, schreib es auf

Typische Eingänge zum Erfassen:
- „Ich muss den Zahnarzt anrufen“
- „Idee für ein neues Projekt“
- „Geburtstagsgeschenk kaufen“
- „Auf die E-Mail vom Chef antworten“
- „Tropfenden Wasserhahn reparieren“`,

    clarifyTitle: "2. Klären (Clarify)",
    clarifyContent: `Geh jeden erfassten Eingang durch und stell dir die entscheidende Frage: „Ist das umsetzbar? Kann ich etwas damit tun?“

Wenn NEIN:
- Löschen (nicht benötigt)
- Als Referenzmaterial archivieren (könnte später nützlich sein)
- In die Liste „Irgendwann/Vielleicht“ verschieben (gerade nicht aktuell, aber du willst es nicht verlieren)

Wenn JA, die nächste Frage: „Was ist der allernächste konkrete Schritt?“
- Dauert es weniger als 2 Minuten → erledige es sofort (die 2-Minuten-Regel)
- Erfordert es mehrere Schritte → leg ein Projekt an
- Muss es jemand anderes erledigen → delegiere es und verfolge es in der Liste „Warten auf“
- Hat es einen festen Termin → trag es in deinen Kalender ein

Wichtig: Jede Aufgabe muss als konkreter physischer Schritt formuliert sein. Nicht „Mamas Geburtstag“, sondern „Torte bei Madame Gâteaux kaufen“ oder „Restaurant für Samstag reservieren“.`,

    organizeTitle: "3. Organisieren (Organize)",
    organizeContent: `Ordne die geklärten Aufgaben in die richtigen Listen und Kategorien ein. GTD empfiehlt folgende Struktur:

Nächste Schritte (Next Actions):
Konkrete physische Aufgaben, die du sofort erledigen kannst. Das ist deine wichtigste Arbeitsliste. Jede Aufgabe sollte eine konkrete Tätigkeit beschreiben: „… anrufen“, „… schreiben“, „… kaufen“, „… reparieren“.

Projekte:
Alles, was mehr als einen Schritt bis zum Abschluss erfordert. „Geburtstagsfeier organisieren“ ist ein Projekt mit Schritten wie Torte bestellen, Gäste einladen, dekorieren. Jedes Projekt muss mindestens einen festgelegten nächsten Schritt haben.

Warten auf (Waiting For):
Aufgaben, die du delegiert hast oder bei denen du auf eine Antwort wartest. Notiere dir, wann du delegiert hast und auf wen du wartest.

Irgendwann/Vielleicht (Someday/Maybe):
Ideen und Projekte, die du jetzt nicht angehen, aber auch nicht verlieren willst. „Spanisch lernen“, „Einen Blog schreiben“, „Island besuchen“. Sieh sie regelmäßig durch.

Kalender:
Nur Dinge mit festem Datum und fester Uhrzeit. GTD unterscheidet strikt zwischen „muss am 15. März erledigt sein“ und „würde ich gern bald machen“. In den Kalender gehört nur Ersteres.

Referenzmaterial:
Informationen, die keine Aktion erfordern, aber nützlich sein könnten – Telefonnummern, Besprechungsnotizen, Anleitungen.

Kontextlisten:
Kontexte sind das Herzstück von GTD. Statt dich zu fragen „Was sollte ich tun?“, schaust du auf den Kontext, in dem du dich gerade befindest – und der sagt dir, was du tun kannst. Gruppiere Aufgaben nach Kontext:
- Computer – „Rechnungen verschicken“, „Flüge buchen“, „Blogartikel schreiben“
- Telefon – „Zahnarzt anrufen“, „Arzttermin vereinbaren“, „Treffen mit Peter ausmachen“
- Zu Hause – „Wohnzimmer staubsaugen“, „Tropfenden Wasserhahn reparieren“, „Garage aufräumen“
- Besorgungen – „Milch und Brot kaufen“, „Paket bei der Post abholen“, „Geschenk für Mama kaufen“
- Büro – „Vertrag ausdrucken“, „Mit dem Chef über das Projekt sprechen“, „Papier im Drucker nachfüllen“
- Unterwegs – „Kleidung in die Reinigung bringen“, „Schlüssel beim Vermieter abholen“, „Im Park joggen gehen“

So geht's in SweptMind:
SweptMind bietet dir zwei Möglichkeiten, Kontexte einzurichten. Die erste ist der Gerätekontext – du ordnest jede Liste oder jeden Tag entweder dem Computer oder dem Handy zu. Die App erkennt automatisch, welches Gerät du gerade benutzt, und hebt passende Listen gelb hervor. Die zweite ist der Ort – du weist einer Liste oder einem Tag einen bestimmten Ort zu (z. B. „Zu Hause“, „Büro“, „Rewe am Marktplatz“). SweptMind verfolgt deinen Standort und hebt Listen in der Nähe grün hervor.

Tipp: Kontexte kannst du nicht nur Listen, sondern auch Tags zuweisen. Ein Tag „Einkaufen“ mit dem Ort „Rewe“ hebt alle Einkaufsaufgaben hervor, sobald du in der Nähe des Ladens bist.`,

    engageTitle: "4. Erledigen (Engage)",
    engageContent: `Jetzt, wo alles organisiert ist, kannst du dich aufs Erledigen konzentrieren. GTD schlägt 4 Kriterien für die Wahl deiner nächsten Aufgabe vor:

1. Kontext: Wo bist du? Was steht dir zur Verfügung? Sitzt du am Computer, schau in die Liste „Computer“. Bist du unterwegs, in die Liste „Besorgungen“. SweptMind automatisiert das mit der Funktion „Hier & Jetzt“.

2. Verfügbare Zeit: Hast du 5 Minuten oder eine Stunde? Wähle Aufgaben, die in dein Zeitfenster passen.

3. Verfügbare Energie: Bist du frisch und konzentriert oder müde? Heb dir anspruchsvolle Aufgaben für die Zeit auf, in der du die meiste Energie hast.

4. Priorität: Wähle aus den übrigen Aufgaben (gefiltert nach Kontext, Zeit und Energie) die wichtigste aus.

Grundprinzip: Entscheide nicht erst im Moment der Ausführung, WAS du tust. Diese Entscheidung ist bereits in den Schritten 2 und 3 gefallen. Jetzt wählst du nur noch aus und legst los.

SweptMind geht noch einen Schritt weiter – Aufgaben, die du gerade nicht erledigen kannst, werden komplett ausgeblendet. Zukünftige Aufgaben (mit einem Fälligkeitsdatum in der Zukunft) sind automatisch unsichtbar und tauchen erst auf, wenn sie aktuell werden. So wird dein Kopf nicht mit Dingen belastet, an denen du gerade ohnehin nichts tun kannst. Du siehst nur, was als Nächstes ansteht – genau so, wie GTD es vorsieht.`,

    reviewTitle: "5. Überprüfen (Review)",
    reviewContent: `Die regelmäßige Überprüfung ist der Motor von GTD. Ohne sie fällt das System auseinander. David Allen empfiehlt:

Tägliche Überprüfung:
- Morgens: Wirf einen Blick auf deinen Kalender und deine Liste der nächsten Schritte
- Abends: Erfasse alles, was im Laufe des Tages aufgetaucht ist

Wöchentliche Überprüfung (das wichtigste GTD-Ritual):
Geh jede Woche (idealerweise am Freitagnachmittag oder am Wochenende) dein GESAMTES System durch:
1. Leere alle Eingangskörbe (E-Mail, Notizen, physischer Eingangskorb)
2. Geh deine Liste der nächsten Schritte durch – ist sie aktuell?
3. Geh alle Projekte durch – hat jedes einen festgelegten nächsten Schritt?
4. Geh „Warten auf“ durch – musst du irgendwo nachhaken?
5. Geh „Irgendwann/Vielleicht“ durch – ist etwas aktuell geworden?
6. Geh deinen Kalender durch (vergangene und kommende Woche)
7. Ergänze fehlende Aufgaben

Eine wöchentliche Überprüfung dauert meist 30–60 Minuten. Es ist eine Investition, die sich in Form von Ruhe und Überblick vielfach auszahlt.`,

    horizonsTitle: "Die 6 Horizonte der Aufmerksamkeit",
    horizonsContent: `GTD definiert 6 Perspektivebenen – von konkreten Aufgaben bis zum Lebenssinn:

Bodenhöhe: Nächste Schritte
Konkrete Aufgaben, die du physisch erledigen kannst. „Kunden anrufen“, „E-Mail schreiben“.

10.000 Fuß: Projekte
Ergebnisse, die mehrere Schritte erfordern. „Neue Website starten“, „In eine neue Wohnung umziehen“.

20.000 Fuß: Verantwortungsbereiche
Lebensbereiche, um die du dich kümmerst: Gesundheit, Finanzen, Familie, Karriere, Haushalt. Aus jedem Bereich entstehen Projekte.

30.000 Fuß: Ziele für 1–2 Jahre
Was willst du in absehbarer Zeit erreichen? „Befördert werden“, „Programmieren lernen“, „10 kg abnehmen“.

40.000 Fuß: Vision für 3–5 Jahre
Wo willst du in 3–5 Jahren stehen? Berufliche Richtung, Lebensstil, Ausbildung.

50.000 Fuß: Sinn und Prinzipien
Warum bist du hier? Warum tust du, was du tust? Deine Werte und deine Lebensaufgabe.

Die wöchentliche Überprüfung deckt vor allem die Bodenhöhe und 10.000 Fuß ab. Höhere Horizonte solltest du monatlich oder vierteljährlich überprüfen.`,

    tipsTitle: "Praktische Tipps für den Einstieg",
    tipsContent: `So startest du mit GTD:

1. Die große Kopfleerung („Mind Sweep“): Nimm dir 1–2 Stunden Zeit. Schreib wirklich alles auf, was dir im Kopf herumgeht. David Allen empfiehlt, mindestens 100 Punkte zu erfassen. Du wirst überrascht sein, wie viel du im Kopf mit dir herumträgst.

2. Arbeite deinen Eingangskorb ab: Geh jeden Punkt mit der Frage „Was ist der nächste Schritt?“ durch. Nutze die 2-Minuten-Regel – alles, was kürzer dauert, erledigst du sofort.

3. Richte deine Listen ein: Leg in SweptMind die Grundlisten an – Nächste Schritte, Warten auf, Irgendwann/Vielleicht – und Kontextlisten nach deinem Bedarf.

4. Führe die wöchentliche Überprüfung ein: Plane dafür einen festen Termin in deinem Kalender ein. Das ist die wichtigste Gewohnheit der ganzen Methode.

5. Hab Geduld: Bis dir GTD ganz in Fleisch und Blut übergeht, dauert es 2–3 Monate. Fang einfach an und steigere die Komplexität nach und nach.

Häufige Fehler:
- Zu vage Aufgaben (statt „Zahnarzt anrufen“ steht da „Das mit den Zähnen klären“) – sei konkret
- Die wöchentliche Überprüfung vergessen – ohne sie bricht das System zusammen
- Zu viele Listen – fang einfach an
- Perfektionismus – GTD ist ein Werkzeug, kein Selbstzweck`,

    bookTitle: "Über das Buch",
    bookContent: `„Getting Things Done: The Art of Stress-Free Productivity“ stammt von David Allen und erschien erstmals 2001 (auf Deutsch als „Wie ich die Dinge geregelt kriege“). Die überarbeitete Ausgabe von 2015 berücksichtigt das digitale Zeitalter. Das Buch hat sich weltweit millionenfach verkauft, und GTD ist zu einem der meistgenutzten Systeme für persönliche Produktivität geworden.

David Allen arbeitete als Produktivitätsberater für Unternehmen und Einzelpersonen. Sein Ansatz ist einzigartig, weil er sich nicht auf das Setzen von Prioritäten konzentriert (wie viele andere Systeme), sondern auf das vollständige Erfassen und Organisieren aller Eingänge – was zu einem „Geist wie Wasser“ (mind like water) führt, einem Zustand von Ruhe und Bereitschaft.

SweptMind ist so gestaltet, dass es den GTD-Workflow ganz natürlich unterstützt – vom schnellen Erfassen einer Aufgabe über das Organisieren in Kontextlisten bis zur Funktion „Hier & Jetzt“, die dir hilft, dich auf das zu konzentrieren, was du gerade tun kannst.`,

    ctaTitle: "Starte mit GTD in SweptMind",
  },
  hiddenTasks: {
    title: "Beispiel: Ausgeblendete zukünftige Aufgaben",
    desc: "Du siehst nur, was aktuell ist. Zukünftige Aufgaben sind ausgeblendet und tauchen automatisch auf.",
    visibleTasks: [
      { title: "Zahnarzt anrufen" },
      { title: "Milch kaufen" },
      { title: "Rechnungen verschicken" },
    ],
    futureLabel: "Zukünftig",
    futureTasks: [
      { title: "Präsentation vorbereiten", date: "15. März" },
      { title: "Führerschein verlängern", date: "22. März" },
      { title: "Geburtstag von Mama – Geschenk kaufen", date: "5. Apr." },
    ],
    listName: "Aufgaben",
  },
  contextExample: {
    title: "Beispiel: So funktionieren Kontexte in SweptMind",
    step1Title: "Erstelle eine Liste mit Ort",
    step1Desc: "Erstelle eine Liste namens „Zu Hause“ und weise ihr deine Wohnadresse zu.",
    step2Title: "Erstelle eine Liste mit Gerätekontext",
    step2Desc: "Erstelle eine Liste namens „Am Computer“ mit dem Gerätekontext „Computer“.",
    step3Title: "„Hier & Jetzt“ verbindet beide Kontexte",
    step3Desc:
      "Wenn du nach Hause kommst und SweptMind am Computer öffnest, siehst du die Aufgaben aus beiden Listen auf einmal. Du musst dich nicht durch einzelne Listen klicken – das erledigt die App für dich.",
    homeTasks: ["Wohnzimmer staubsaugen", "Blumen gießen", "Wasserhahn reparieren"],
    computerTasks: ["Rechnungen verschicken", "Flüge buchen"],
    nearby: "In der Nähe",
    deviceMatch: "Dein Computer",
    homeList: "Zu Hause",
    computerList: "Am Computer",
    hereAndNow: "Hier & Jetzt",
  },
};
