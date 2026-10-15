import type { GtdContent } from "./types";

export const it: GtdContent = {
  page: {
    backHome: "Torna alla home",
    title: "Getting Things Done",
    subtitle: "Guida completa al metodo GTD di David Allen",
    introTitle: "Cos'è GTD?",
    intro: `Getting Things Done (GTD) è un metodo di produttività personale ideato da David Allen e descritto nel suo libro “Getting Things Done: The Art of Stress-Free Productivity” (2001). L'idea di fondo è semplice: la mente serve ad avere idee, non a conservarle. Quando sposti tutti i tuoi impegni, le attività e le idee dalla testa a un sistema esterno affidabile, liberi capacità mentale per pensare in modo creativo e concentrarti sul lavoro che hai davanti.

GTD non è l'ennesima to-do list. È un sistema completo per elaborare tutti gli input che ti arrivano – email, idee, compiti dai colleghi, impegni personali – e trasformarli in prossime azioni concrete.`,

    principlesTitle: "I 5 passi fondamentali di GTD",

    captureTitle: "1. Raccogliere (Capture)",
    captureContent: `Il primo passo, e il più importante: raccogli assolutamente tutto ciò che richiede la tua attenzione. Ogni pensiero, attività, idea, impegno o informazione che ti frulla per la testa finisce in un unico posto – la tua “inbox”.

L'inbox può essere fisica (un vassoio per i fogli) o digitale (un'app come SweptMind). I principi chiave:
- Raccogli subito, appena ti viene in mente qualcosa
- Non valutare né ordinare mentre raccogli
- Tieni l'inbox sempre a portata di mano (un'app sul telefono è l'ideale)
- Regola: se ci pensi da più di 2 minuti, scrivilo

Input tipici da raccogliere:
- “Devo chiamare il dentista”
- “Idea per un nuovo progetto”
- “Comprare un regalo di compleanno”
- “Rispondere all'email del capo”
- “Riparare il rubinetto che gocciola”`,

    clarifyTitle: "2. Chiarire (Clarify)",
    clarifyContent: `Passa in rassegna ogni input raccolto e fatti la domanda chiave: “Richiede un'azione? Posso farci qualcosa?”

Se NO:
- Eliminalo (non serve)
- Archivialo come materiale di riferimento (potrebbe servire più avanti)
- Spostalo nella lista “Un giorno/Forse” (non è attuale, ma non vuoi perderlo)

Se SÌ, prossima domanda: “Qual è la prossima azione fisica?”
- Se richiede meno di 2 minuti → falla subito (la regola dei 2 minuti)
- Se richiede più passaggi → crea un progetto
- Se deve farla qualcun altro → delegala e tienila d'occhio nella lista “In attesa”
- Se ha una scadenza precisa → mettila in calendario

Importante: ogni attività va formulata come un passo fisico concreto. Non “Compleanno della mamma”, ma “Comprare la torta da Madame Gâteaux” o “Prenotare il ristorante per sabato”.`,

    organizeTitle: "3. Organizzare (Organize)",
    organizeContent: `Metti le attività smistate nelle liste e nelle categorie giuste. GTD consiglia questa struttura:

Prossime azioni (Next Actions):
Attività fisiche concrete che puoi fare subito. È la tua lista di lavoro principale. Ogni attività dovrebbe iniziare con un verbo: “Chiamare...”, “Scrivere...”, “Comprare...”, “Riparare...”.

Progetti:
Tutto ciò che richiede più di un passo per essere completato. “Organizzare una festa di compleanno” è un progetto con passaggi come ordinare la torta, invitare gli ospiti, preparare le decorazioni. Ogni progetto deve avere almeno una prossima azione definita.

In attesa (Waiting For):
Attività che hai delegato o per cui aspetti una risposta. Annota la data della delega e da chi stai aspettando.

Un giorno/Forse (Someday/Maybe):
Idee e progetti che non vuoi fare ora, ma che non vuoi perdere. “Imparare lo spagnolo”, “Scrivere un blog”, “Visitare l'Islanda”. Rivedili regolarmente.

Calendario:
Solo le cose con data e ora fisse. GTD distingue rigorosamente tra “devo farlo il 15 marzo” e “vorrei farlo presto”. In calendario va solo il primo caso.

Materiale di riferimento:
Informazioni che non richiedono un'azione, ma potrebbero tornare utili – numeri, appunti delle riunioni, manuali.

Liste di contesto:
I contesti sono il cuore di GTD. Invece di chiederti “cosa dovrei fare?”, guardi il contesto in cui ti trovi, ed è lui a dirti cosa puoi fare. Raggruppa le attività per contesto:
- Computer – “Inviare le fatture”, “Prenotare i voli”, “Scrivere un articolo per il blog”
- Telefono – “Chiamare il dentista”, “Prenotare una visita dal medico”, “Fissare un incontro con Pietro”
- Casa – “Passare l'aspirapolvere in salotto”, “Riparare il rubinetto che gocciola”, “Sistemare il garage”
- Commissioni – “Comprare latte e pane”, “Ritirare un pacco all'ufficio postale”, “Comprare un regalo per la mamma”
- Ufficio – “Stampare il contratto”, “Parlare del progetto con il capo”, “Rimettere la carta nella stampante”
- Fuori – “Portare i vestiti in tintoria”, “Ritirare le chiavi dal padrone di casa”, “Andare a correre al parco”

Come farlo in SweptMind:
SweptMind ti offre due modi per impostare i contesti. Il primo è il contesto del dispositivo – assegni ogni lista o tag al computer o al telefono. L'app riconosce automaticamente il dispositivo che stai usando ed evidenzia in giallo le liste pertinenti. Il secondo è il luogo – assegni a una lista o a un tag un posto preciso (come “Casa”, “Ufficio”, “Esselunga di viale Monza”). SweptMind segue la tua posizione ed evidenzia in verde le liste vicine.

Suggerimento: puoi assegnare i contesti anche ai tag, non solo alle liste. Un tag “Spesa” con il luogo “Esselunga” evidenzierà tutte le attività con quel tag quando sei vicino al negozio.`,

    engageTitle: "4. Agire (Engage)",
    engageContent: `Ora che è tutto organizzato, puoi concentrarti sul fare. GTD suggerisce 4 criteri per scegliere la prossima attività:

1. Contesto: dove sei? Cosa hai a disposizione? Se sei al computer, guarda la lista Computer. Se sei fuori, controlla Commissioni. SweptMind lo automatizza con la funzione “Qui e ora”.

2. Tempo disponibile: hai 5 minuti o un'ora? Scegli attività che rientrano nel tempo che hai.

3. Energia disponibile: hai la testa lucida o sei a pezzi? Tieni le attività impegnative per quando hai più energia.

4. Priorità: tra le attività rimaste (filtrate per contesto, tempo ed energia), scegli la più importante.

Principio chiave: non decidere COSA fare nel momento in cui agisci. Quella decisione l'hai già presa nei passi 2 e 3. Ora devi solo scegliere e lavorare.

SweptMind va ancora oltre – le attività che non puoi fare adesso sono completamente nascoste. Le attività future (con una scadenza nel futuro) sono automaticamente invisibili e compaiono solo quando diventano attuali. La tua mente non è appesantita da cose su cui comunque non puoi agire. Vedi solo ciò che tocca adesso – esattamente come vuole GTD.`,

    reviewTitle: "5. Rivedere (Review)",
    reviewContent: `La revisione regolare è il motore di GTD. Senza, il sistema crolla. David Allen consiglia:

Revisione quotidiana:
- Mattina: controlla il calendario e la lista delle prossime azioni
- Sera: raccogli tutto ciò che è emerso durante la giornata

Revisione settimanale (il rituale più importante di GTD):
Ogni settimana (idealmente il venerdì pomeriggio o nel weekend) ripassa TUTTO il sistema:
1. Svuota tutte le inbox (email, appunti, inbox fisica)
2. Rivedi la lista delle prossime azioni – è aggiornata?
3. Rivedi tutti i progetti – ognuno ha una prossima azione definita?
4. Rivedi “In attesa” – devi sollecitare qualcuno?
5. Rivedi “Un giorno/Forse” – qualcosa è diventato attuale?
6. Rivedi il calendario (settimana passata e prossima)
7. Aggiungi le attività mancanti

Una revisione settimanale richiede di solito 30–60 minuti. È un investimento che ti ripaga molte volte in serenità e chiarezza.`,

    horizonsTitle: "I 6 orizzonti di focus",
    horizonsContent: `GTD definisce 6 livelli di prospettiva, dalle attività concrete allo scopo della vita:

Livello del suolo: Prossime azioni
Attività concrete che puoi fare fisicamente. “Chiamare il cliente”, “Scrivere l'email”.

10.000 piedi: Progetti
Risultati che richiedono più passaggi. “Lanciare il nuovo sito web”, “Traslocare in un nuovo appartamento”.

20.000 piedi: Aree di responsabilità
Le aree della vita che gestisci: salute, finanze, famiglia, carriera, casa. Ogni area genera progetti.

30.000 piedi: Obiettivi a 1–2 anni
Cosa vuoi ottenere nel prossimo futuro? “Ottenere una promozione”, “Imparare a programmare”, “Perdere 10 kg”.

40.000 piedi: Visione a 3–5 anni
Dove vuoi essere tra 3–5 anni? Direzione di carriera, stile di vita, formazione.

50.000 piedi: Scopo e principi
Perché sei qui? Perché fai quello che fai? I tuoi valori e la tua missione di vita.

La revisione settimanale copre soprattutto il livello del suolo e i 10.000 piedi. Rivedi gli orizzonti più alti ogni mese o ogni trimestre.`,

    tipsTitle: "Consigli pratici per iniziare",
    tipsContent: `Come iniziare con GTD:

1. La grande “svuotata” (Mind Sweep): prenditi 1–2 ore. Scrivi assolutamente tutto ciò che hai in testa. David Allen consiglia di raccogliere almeno 100 voci. Ti sorprenderà quante cose ti porti in testa.

2. Elabora l'inbox: passa ogni voce con la regola “Qual è la prossima azione?”. Usa la regola dei 2 minuti – tutto ciò che richiede meno, fallo subito.

3. Imposta le liste: crea in SweptMind le liste di base – Prossime azioni, In attesa, Un giorno/Forse e le liste di contesto in base alle tue esigenze.

4. Fissa la revisione settimanale: blocca un orario fisso nel calendario. È l'abitudine più importante di tutto il metodo.

5. Abbi pazienza: per adottare completamente GTD servono 2–3 mesi. Parti semplice e aggiungi complessità gradualmente.

Errori comuni:
- Attività troppo vaghe (invece di “Chiamare il dentista” scrivere “Sistemare i denti”) – scrivi azioni concrete
- Dimenticare la revisione settimanale – senza, il sistema crolla
- Avere troppe liste – parti semplice
- Inseguire la perfezione – GTD è uno strumento, non un fine`,

    bookTitle: "Il libro",
    bookContent: `“Getting Things Done: The Art of Stress-Free Productivity” è stato scritto da David Allen e pubblicato per la prima volta nel 2001. L'edizione aggiornata del 2015 tiene conto dell'era digitale. Il libro ha venduto milioni di copie in tutto il mondo e GTD è diventato uno dei sistemi di produttività personale più diffusi.

David Allen ha lavorato come consulente di produttività per aziende e privati. Il suo approccio è unico perché non si concentra sullo stabilire le priorità (come molti altri sistemi), ma sulla raccolta e sull'organizzazione completa di tutti gli input – il che porta alla “mente come l'acqua” (mind like water), uno stato di calma e prontezza.

SweptMind è pensato per supportare in modo naturale il flusso di lavoro GTD – dalla raccolta rapida delle attività, passando per l'organizzazione in liste di contesto, fino alla funzione “Qui e ora”, che ti aiuta a concentrarti su ciò che puoi fare in questo momento.`,

    ctaTitle: "Inizia a usare GTD con SweptMind",
  },
  hiddenTasks: {
    title: "Esempio: attività future nascoste",
    desc: "Vedi solo ciò che è attuale. Le attività future sono nascoste e compaiono automaticamente.",
    visibleTasks: [
      { title: "Chiamare il dentista" },
      { title: "Comprare il latte" },
      { title: "Inviare le fatture" },
    ],
    futureLabel: "Future",
    futureTasks: [
      { title: "Preparare la presentazione", date: "15 mar" },
      { title: "Rinnovare la patente", date: "22 mar" },
      { title: "Compleanno della mamma – comprare un regalo", date: "5 apr" },
    ],
    listName: "Attività",
  },
  contextExample: {
    title: "Esempio: come funzionano i contesti in SweptMind",
    step1Title: "Crea una lista con un luogo",
    step1Desc: "Crea una lista chiamata “Casa” e assegnale il tuo indirizzo di casa.",
    step2Title: "Crea una lista con un contesto dispositivo",
    step2Desc:
      "Crea una lista chiamata “Al computer” con il contesto dispositivo impostato su “computer”.",
    step3Title: "“Qui e ora” unisce entrambi i contesti",
    step3Desc:
      "Quando torni a casa e apri SweptMind sul computer, vedi insieme le attività di entrambe le liste. Non serve sfogliare le singole liste – l'app lo fa per te.",
    homeTasks: [
      "Passare l'aspirapolvere in salotto",
      "Annaffiare le piante",
      "Riparare il rubinetto",
    ],
    computerTasks: ["Inviare le fatture", "Prenotare i voli"],
    nearby: "Nelle vicinanze",
    deviceMatch: "Il tuo computer",
    homeList: "Casa",
    computerList: "Al computer",
    hereAndNow: "Qui e ora",
  },
};
