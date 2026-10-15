import type { GtdContent } from "./types";

export const fr: GtdContent = {
  page: {
    backHome: "Retour à l'accueil",
    title: "Getting Things Done",
    subtitle: "Le guide complet de la méthode GTD de David Allen",
    introTitle: "Qu'est-ce que GTD ?",
    intro: `Getting Things Done (GTD) est une méthode d'organisation personnelle développée par David Allen et décrite dans son livre « Getting Things Done: The Art of Stress-Free Productivity » (2001). L'idée de base est simple : votre esprit est fait pour avoir des idées, pas pour les stocker. Lorsque vous transférez tous vos engagements, tâches et idées de votre tête vers un système externe fiable, vous libérez de la capacité mentale pour la réflexion créative et pour vous concentrer sur le travail en cours.

GTD n'est pas une simple liste de tâches de plus. C'est un système complet pour traiter tout ce qui vous parvient – e-mails, idées, tâches confiées par des collègues, engagements personnels – et le transformer en prochaines actions concrètes.`,

    principlesTitle: "Les 5 étapes clés de GTD",

    captureTitle: "1. Capturer",
    captureContent: `La première étape, et la plus importante : capturez absolument tout ce qui demande votre attention. Chaque pensée, tâche, idée, engagement ou information qui vous trotte dans la tête va au même endroit – votre « boîte de réception ».

Votre boîte de réception peut être physique (une bannette à papiers) ou numérique (une application comme SweptMind). Les principes clés :
- Capturez immédiatement, dès que quelque chose surgit
- N'évaluez pas et ne triez pas pendant la capture
- Gardez toujours votre boîte de réception à portée de main (une application mobile est idéale)
- Règle : si vous pensez à quelque chose depuis plus de 2 minutes, notez-le

Exemples typiques à capturer :
- « Je dois appeler le dentiste »
- « Idée pour un nouveau projet »
- « Acheter un cadeau d'anniversaire »
- « Répondre à l'e-mail du chef »
- « Réparer le robinet qui fuit »`,

    clarifyTitle: "2. Clarifier",
    clarifyContent: `Passez en revue chaque élément capturé et posez-vous la question clé : « Est-ce que cela demande une action ? Puis-je faire quelque chose ? »

Si NON :
- Supprimez-le (inutile)
- Archivez-le comme référence (cela pourra servir plus tard)
- Placez-le dans la liste « Un jour/Peut-être » (pas d'actualité, mais vous ne voulez pas le perdre)

Si OUI, question suivante : « Quelle est la toute prochaine action physique ? »
- Si cela prend moins de 2 minutes → faites-le tout de suite (la règle des 2 minutes)
- Si cela demande plusieurs étapes → créez un projet
- Si quelqu'un d'autre doit s'en charger → déléguez et suivez-le dans la liste « En attente »
- Si cela a une date précise → planifiez-le dans votre calendrier

Important : chaque tâche doit être formulée comme une étape physique concrète. Pas « Anniversaire de maman », mais « Commander un gâteau à la pâtisserie » ou « Réserver un restaurant pour samedi ».`,

    organizeTitle: "3. Organiser",
    organizeContent: `Rangez les tâches clarifiées dans les bonnes listes et catégories. GTD recommande la structure suivante :

Prochaines actions :
Des tâches physiques concrètes que vous pouvez faire tout de suite. C'est votre principale liste de travail. Chaque tâche devrait commencer par un verbe : « Appeler… », « Écrire… », « Acheter… », « Réparer… ».

Projets :
Tout ce qui demande plus d'une étape pour être terminé. « Organiser une fête d'anniversaire » est un projet, avec des étapes comme commander le gâteau, inviter les amis, décorer. Chaque projet doit avoir au moins une prochaine action définie.

En attente :
Les tâches que vous avez déléguées ou pour lesquelles vous attendez une réponse. Notez la date de délégation et la personne dont vous attendez un retour.

Un jour/Peut-être :
Les idées et projets que vous ne voulez pas réaliser maintenant, mais que vous ne voulez pas perdre. « Apprendre l'espagnol », « Écrire un blog », « Visiter l'Islande ». À revoir régulièrement.

Calendrier :
Uniquement les éléments avec une date et une heure fixes. GTD distingue strictement « à faire le 15 mars » et « j'aimerais le faire bientôt ». Seul le premier va dans le calendrier.

Documentation de référence :
Les informations qui ne demandent aucune action mais peuvent servir – numéros, notes de réunion, modes d'emploi.

Listes de contexte :
Les contextes sont le cœur de GTD. Au lieu de vous demander « que dois-je faire ? », vous regardez le contexte dans lequel vous vous trouvez, et il vous indique ce que vous pouvez faire. Regroupez les tâches par contexte :
- Ordinateur – « Envoyer les factures », « Réserver les billets d'avion », « Écrire un article de blog »
- Téléphone – « Appeler le dentiste », « Prendre rendez-vous chez le médecin », « Fixer une réunion avec Pierre »
- Maison – « Passer l'aspirateur dans le salon », « Réparer le robinet qui fuit », « Ranger le garage »
- Courses – « Acheter du lait et du pain », « Retirer le colis à la poste », « Acheter un cadeau pour maman »
- Bureau – « Imprimer le contrat », « Parler du projet avec le chef », « Remettre du papier dans l'imprimante »
- Dehors – « Déposer les vêtements au pressing », « Récupérer les clés chez le propriétaire », « Aller courir au parc »

Comment faire dans SweptMind :
SweptMind vous offre deux façons de définir des contextes. La première est le contexte d'appareil – associez chaque liste ou étiquette à l'ordinateur ou au téléphone. L'application détecte automatiquement l'appareil que vous utilisez et met en évidence les listes concernées en jaune. La seconde est le lieu – associez un lieu précis à une liste ou à une étiquette (par exemple « Maison », « Bureau », « Carrefour du centre-ville »). SweptMind suit votre position et met en évidence en vert les listes à proximité.

Astuce : vous pouvez aussi attribuer des contextes aux étiquettes, pas seulement aux listes. Une étiquette « Courses » associée au lieu « Carrefour » mettra en évidence toutes les tâches de courses quand vous serez près du magasin.`,

    engageTitle: "4. Agir",
    engageContent: `Maintenant que tout est organisé, vous pouvez vous concentrer sur l'exécution. GTD propose 4 critères pour choisir votre prochaine tâche :

1. Le contexte : où êtes-vous ? De quoi disposez-vous ? Si vous êtes devant l'ordinateur, consultez la liste Ordinateur. Si vous êtes dehors, regardez la liste Courses. SweptMind automatise cela grâce à la fonction « Ici & maintenant ».

2. Le temps disponible : avez-vous 5 minutes ou une heure ? Choisissez des tâches qui tiennent dans le temps dont vous disposez.

3. L'énergie disponible : êtes-vous en pleine forme ou plutôt à plat ? Gardez les tâches exigeantes pour les moments où vous avez le plus d'énergie.

4. La priorité : parmi les tâches restantes (filtrées par contexte, temps et énergie), choisissez la plus importante.

Principe clé : ne décidez pas QUOI faire au moment d'agir. Cette décision a été prise aux étapes 2 et 3. Maintenant, il ne reste qu'à choisir et à travailler.

SweptMind va encore plus loin – les tâches que vous ne pouvez pas faire maintenant sont entièrement masquées. Les tâches futures (avec une échéance à venir) sont automatiquement invisibles et n'apparaissent que lorsqu'elles deviennent d'actualité. Votre esprit n'est pas encombré par des choses sur lesquelles vous ne pouvez de toute façon pas agir. Vous ne voyez que ce qui est à faire maintenant – exactement comme le veut GTD.`,

    reviewTitle: "5. Passer en revue",
    reviewContent: `La revue régulière est le moteur de GTD. Sans elle, le système s'effondre. David Allen recommande :

Revue quotidienne :
- Le matin : consultez votre calendrier et votre liste de prochaines actions
- Le soir : capturez tout ce qui est apparu pendant la journée

Revue hebdomadaire (le rituel GTD le plus important) :
Chaque semaine (idéalement le vendredi après-midi ou le week-end), passez en revue TOUT votre système :
1. Videz toutes vos boîtes de réception (e-mails, notes, bannette physique)
2. Relisez votre liste de prochaines actions – est-elle à jour ?
3. Passez en revue tous vos projets – chacun a-t-il une prochaine action définie ?
4. Vérifiez la liste « En attente » – faut-il relancer quelqu'un ?
5. Parcourez « Un jour/Peut-être » – quelque chose est-il devenu d'actualité ?
6. Consultez votre calendrier (semaine passée et semaine à venir)
7. Ajoutez les tâches manquantes

Une revue hebdomadaire prend généralement 30 à 60 minutes. C'est un investissement largement rentabilisé en sérénité et en clarté.`,

    horizonsTitle: "Les 6 horizons de focalisation",
    horizonsContent: `GTD définit 6 niveaux de perspective, des tâches concrètes jusqu'à la raison d'être :

Niveau du sol : Prochaines actions
Les tâches concrètes que vous pouvez faire physiquement. « Appeler le client », « Écrire l'e-mail ».

10 000 pieds : Projets
Des résultats qui demandent plusieurs étapes. « Lancer le nouveau site web », « Déménager dans un nouvel appartement ».

20 000 pieds : Domaines de responsabilité
Les domaines de votre vie que vous gérez : santé, finances, famille, carrière, maison. Chaque domaine génère des projets.

30 000 pieds : Objectifs à 1–2 ans
Que voulez-vous accomplir dans un avenir proche ? « Obtenir une promotion », « Apprendre à coder », « Perdre 10 kg ».

40 000 pieds : Vision à 3–5 ans
Où voulez-vous être dans 3 à 5 ans ? Orientation professionnelle, mode de vie, formation.

50 000 pieds : Raison d'être et principes
Pourquoi êtes-vous ici ? Pourquoi faites-vous ce que vous faites ? Vos valeurs et votre mission de vie.

La revue hebdomadaire couvre surtout le niveau du sol et les 10 000 pieds. Revoyez les horizons supérieurs chaque mois ou chaque trimestre.`,

    tipsTitle: "Conseils pratiques pour bien démarrer",
    tipsContent: `Comment démarrer avec GTD :

1. La grande « vidange mentale » (Mind Sweep) : réservez 1 à 2 heures. Notez absolument tout ce qui vous occupe l'esprit. David Allen recommande de capturer au moins 100 éléments. Vous n'imaginez pas tout ce que vous gardez en tête.

2. Traitez votre boîte de réception : passez chaque élément au crible de la question « Quelle est la prochaine action ? ». Appliquez la règle des 2 minutes – tout ce qui prend moins de temps, faites-le tout de suite.

3. Créez vos listes : créez dans SweptMind les listes de base – Prochaines actions, En attente, Un jour/Peut-être – et des listes de contexte selon vos besoins.

4. Instaurez la revue hebdomadaire : bloquez un créneau fixe dans votre calendrier. C'est l'habitude la plus importante de toute la méthode.

5. Prenez votre temps : adopter pleinement GTD prend 2 à 3 mois. Commencez simplement et ajoutez de la complexité progressivement.

Erreurs fréquentes :
- Des tâches trop vagues (écrire « M'occuper de mes dents » au lieu de « Appeler le dentiste ») – formulez-les concrètement
- Oublier la revue hebdomadaire – sans elle, le système s'effondre
- Avoir trop de listes – commencez simplement
- Viser la perfection – GTD est un outil, pas une fin en soi`,

    bookTitle: "À propos du livre",
    bookContent: `« Getting Things Done: The Art of Stress-Free Productivity » a été écrit par David Allen et publié pour la première fois en 2001. L'édition mise à jour de 2015 tient compte de l'ère numérique. Le livre s'est vendu à des millions d'exemplaires dans le monde et GTD est devenu l'un des systèmes d'organisation personnelle les plus répandus.

David Allen a travaillé comme consultant en productivité pour des entreprises et des particuliers. Son approche se distingue en ne mettant pas l'accent sur la définition des priorités (comme beaucoup d'autres systèmes), mais sur la capture et l'organisation complètes de tout ce qui vous parvient – ce qui mène à un « esprit comme l'eau » (mind like water), un état de calme et de disponibilité.

SweptMind est conçu pour soutenir naturellement la méthode GTD – de la capture rapide des tâches à leur organisation en listes de contexte, jusqu'à la fonction « Ici & maintenant » qui vous aide à vous concentrer sur ce que vous pouvez faire tout de suite.`,

    ctaTitle: "Adoptez GTD avec SweptMind",
  },
  hiddenTasks: {
    title: "Exemple : tâches futures masquées",
    desc: "Vous ne voyez que ce qui est d'actualité. Les tâches futures sont masquées et apparaissent automatiquement.",
    visibleTasks: [
      { title: "Appeler le dentiste" },
      { title: "Acheter du lait" },
      { title: "Envoyer les factures" },
    ],
    futureLabel: "À venir",
    futureTasks: [
      { title: "Préparer la présentation", date: "15 mars" },
      { title: "Renouveler le permis de conduire", date: "22 mars" },
      { title: "Anniversaire de maman – acheter un cadeau", date: "5 avr." },
    ],
    listName: "Tâches",
  },
  contextExample: {
    title: "Exemple : comment fonctionnent les contextes dans SweptMind",
    step1Title: "Créez une liste avec un lieu",
    step1Desc: "Créez une liste « Maison » et associez-lui l'adresse de votre domicile.",
    step2Title: "Créez une liste avec un contexte d'appareil",
    step2Desc: "Créez une liste « À l'ordinateur » avec le contexte d'appareil « ordinateur ».",
    step3Title: "« Ici & maintenant » réunit les deux contextes",
    step3Desc:
      "Quand vous rentrez chez vous et ouvrez SweptMind sur votre ordinateur, vous voyez les tâches des deux listes à la fois. Inutile de parcourir chaque liste – l'application le fait pour vous.",
    homeTasks: ["Passer l'aspirateur dans le salon", "Arroser les plantes", "Réparer le robinet"],
    computerTasks: ["Envoyer les factures", "Réserver les billets d'avion"],
    nearby: "À proximité",
    deviceMatch: "Votre ordinateur",
    homeList: "Maison",
    computerList: "À l'ordinateur",
    hereAndNow: "Ici & maintenant",
  },
};
