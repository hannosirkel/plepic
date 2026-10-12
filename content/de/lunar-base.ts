import type {
  Attribution,
  CallToAction,
  FaqEntry,
  ListItem,
  Prose,
  Section,
  Statement,
} from "../schema.js";

export const pitch: Statement = {
  text: "Lunar Base ist ein Strategiespiel mit Karten für 2-6 Personen, in dem du um den Bau der mächtigsten Mondbasis (Base) wetteiferst.",
  source: "official-wording",
};

export const differentiator: Statement = {
  text: "Vier Wege zum Sieg, die alle zugleich offenstehen – und Agenten (Agents), die du in fremde Basen schicken kannst, um sie auszubremsen.",
  source: "official-wording",
};

export const heroFacts: readonly Statement[] = [
  { text: "Etwa eine Minute Aufbauzeit.", source: "E11" },
  { text: "Etwa 30 Minuten Spielzeit.", source: "E10" },
];

export const featuredDescription: Prose = [
  "Lunar Base ist ein Strategiespiel mit Karten für 2-6 Personen, in dem du um den Bau der mächtigsten Mondbasis (Base) wetteiferst. Es spielt sich zügig (in etwa 30 Minuten), ist von mittlerer bis leichter Komplexität, leicht zu lernen und schnell aufgebaut.",
  "Für seine kompakte Größe bringt Lunar Base viel auf den Tisch: hochwertiger Druck und Illustrationen, hoher Wiederspielwert, leicht mitzunehmen, flexibel anpassbarer Schwierigkeitsgrad und befriedigende Tiefe dank verschiedener Wege zum Sieg.",
];

export const replayability: Statement = {
  text: "Mit 4 verschiedenen Siegbedingungen, unterschiedlichen Strategien und Kartenkombinationen bietet das Spiel Wiederspielwert und Komplexität. Die zusätzlichen Einflusskarten (Influence) verändern die Dynamik des Spiels.",
  source: "official-wording",
};

export const gameNightUse: Statement = {
  text: "Hol es an Spieleabenden zum Aufwärmen oder Ausklingen auf den Tisch und lass nach Bedarf Leute ein- und aussteigen. Oder mach es im Modus ‚Best of 3 / 5‘ zum Hauptprogrammpunkt.",
  source: "official-wording",
};

export interface FeatureSpec {
  readonly term: string;
  readonly detail: Prose;
  readonly source: Attribution;
}

export const specifications: readonly FeatureSpec[] = [
  {
    term: "Rasantes Spiel",
    detail: ["Eine Partie dauert durchschnittlich 30 Minuten. Ideal für eine Pause!"],
    source: "E10",
  },
  {
    term: "Immer wieder anders",
    detail: ["Jede Partie ist einzigartig. Ergänze weitere Karten oder alternative Regeln."],
    source: "official-wording",
  },
  {
    term: "Schneller Einstieg",
    detail: ["In 20 Minuten gelernt. In 1 Minute aufgebaut."],
    source: "E11",
  },
  {
    term: "Leicht mitzunehmen",
    detail: ["Reisegröße für die Tasche. Nimm es überallhin mit!"],
    source: "E12",
  },
  {
    term: "Spielerzahl und Alter",
    detail: ["2 - 6 Personen", "Ab 10 Jahren"],
    source: "E9",
  },
];

export const howItPlays: Section = {
  anchor: "how-it-plays",
  heading: "Ein Zug besteht aus drei Schritten",
  body: [
    "Spiele Agentenkarten (Agent). Zu Beginn deines Zuges darfst du so viele spielen, wie du bezahlen kannst – um deine eigene Basis voranzubringen oder andere auszubremsen.",
    "Führe eine Hauptaktion (Main Action) deiner Basis aus. Baue ein Modul (Module), wähle eine Karte aus der Auslage (Supply), ziehe eine Karte, wirf eine ab, verkaufe eine weiter, drehe eine Station (Station) um, stiehl ein Modul oder Credits. Eine Aktion aus den Möglichkeiten, die deine Basis tatsächlich bietet – deshalb bestimmt dein Bauwerk, was du im nächsten Zug tun kannst.",
    "Prüfe, ob Shuttles eintreffen. Wenn die Auslage leer ist, erhalten alle für jede vollständige gelbe Sphäre (Orb) in ihrer Basis einen Credit, und neue Karten kommen von der Erde.",
  ],
  source: "rulebook",
};

export const teaserVideos: readonly { heading: string; title: string; youTubeId: string }[] = [
  { heading: "Teaser 1", title: "Lunar Base Teaser - Teil 1", youTubeId: "QZ_Pqf3eY4o" },
  { heading: "Teaser 2", title: "Lunar Base Teaser - Teil 2", youTubeId: "KSuIqu5qzTM" },
  { heading: "Teaser 3", title: "Lunar Base Teaser - Teil 3", youTubeId: "JjlDpS2ByXY" },
  { heading: "Teaser 4", title: "Lunar Base Teaser - Teil 4", youTubeId: "v0lS1aenCXU" },
];

export const victoryPathsIntro: Statement = {
  text: "Um das Wettrennen im All zu gewinnen, nutze die Stärken deiner Station. Gewinne, indem du die meisten Kolonistinnen und Kolonisten beherbergst, wissenschaftliche Errungenschaften erforschst, Mond-Credits anhäufst oder den meisten Einfluss (Influence) gewinnst.",
  source: "official-wording",
};

export const victoryPaths: readonly ListItem[] = [
  {
    term: "Sammle 20 Mond-Credits",
    detail:
      "Nutze den Markt. Verkaufe weiter, was du nicht brauchst, nimm anderen ihre Credits ab und baue nie etwas, das du dir nicht zweimal leisten könntest.",
    source: "rulebook-victory-conditions",
  },
  {
    term: "Beherberge 10 Kolonistinnen und Kolonisten in deiner Basis",
    detail:
      "Baue in die Breite. Kolonistinnen und Kolonisten sind auf deiner Station und auf Modulen zu finden. Dieser Weg verlangt eine große, gut vernetzte Basis – und alle sehen ihn kommen.",
    source: "rulebook-victory-conditions",
  },
  {
    term: "Vollende 5 verschiedene wissenschaftliche Errungenschaften in deiner Basis",
    detail:
      "Fünf verschiedene. Vier Errungenschaften und eine doppelte zählen nicht als Sieg. Darin liegt die Falle für alle, die nicht mitzählen.",
    source: "rulebook-victory-conditions",
  },
  {
    term: "Decke am Ende deines Zuges 4 Einflusskarten aus deiner Hand auf",
    detail:
      "Der stille Weg. Einflusskarten gehören zur fortgeschrittenen Variante. Dieser Weg steht also erst offen, wenn du sie einmischst – und kann das Spiel mit einer Hand beenden, in die niemand geschaut hat.",
    source: "rulebook-victory-conditions",
  },
];

export const victoryPathsNote: Statement = {
  text: "Das Spiel endet in dem Moment, in dem jemand eine Siegbedingung erfüllt. Es gibt keine abschließende Wertungsrunde: Der letzte Zug endet immer mit einem Sieg statt mit gemeinsamem Zusammenzählen.",
  source: "rulebook",
};

export const influenceVariantNote: Statement = {
  text: "Die Spielanleitung empfiehlt, die Einflusskarten in den ersten Partien wegzulassen und sie erst einzumischen, wenn alle mit dem Spiel vertraut sind.",
  source: "rulebook",
};

export const inTheBox: readonly ListItem[] = [
  { term: "6 Stationen (Stations)", detail: "Eine pro Person, beidseitig bedruckt.", source: "components" },
  { term: "26 Agenten (Agents)", detail: "Werden zu Beginn deines Zuges gegen Bezahlung gespielt.", source: "components" },
  { term: "8 Einflusskarten (Influences)", detail: "Die fortgeschrittene Variante und der vierte Weg zum Sieg.", source: "components" },
  { term: "50 Module (Modules)", detail: "Aus ihnen baust du deine Basis.", source: "components" },
  { term: "6 Creditzähler", detail: "Einer pro Person, auf die aktuelle Anzahl deiner Credits eingestellt.", source: "components" },
  { term: "Spielanleitung", detail: "Die vollständigen Regeln kannst du auch auf dieser Website lesen.", source: "rulebook" },
];

export const inTheBoxSummary: Statement = {
  text: "Insgesamt 90 Karten – 6 Stationen (Stations), 26 Agenten (Agents), 8 Einflusskarten (Influences) und 50 Module (Modules) – dazu 6 Creditzähler und die Spielanleitung.",
  source: "components",
};

export const travelsWell: Section = {
  anchor: "travels-well",
  heading: "Passt in die Tasche, die du sowieso dabeihast",
  body: [
    "Die Schachtel misst 12 mal 12 mal 4 Zentimeter und wiegt 200 Gramm. Sie passt ohne Planung ins Rucksackfach.",
    "Das ist der Unterschied zwischen einem Spiel, das du besitzt, und einem, das du spielst: Dieses hier kommt mit in die Kneipe, in die Hütte und zum zweiten Tag einer Spielemesse. Und wenn das große Spiel um elf zu Ende ist, holst du diese Schachtel wieder hervor.",
  ],
  source: "E12",
};

export const factions: readonly ListItem[] = [
  {
    term: "Shackleton",
    detail:
      "Von den Vereinten Nationen unterstützt, baut Shackleton eine große multinationale Stadt – nach der Vorstellung, dass eine Zivilisation im All damit beginnt, dass alle zusammenleben.",
    source: "official-wording",
  },
  {
    term: "Taikotech",
    detail:
      "Davon überzeugt, dass Gewinne aus Bergbau und Schwerindustrie die Menschheit tatsächlich von der Erde wegbringen.",
    source: "official-wording",
  },
  {
    term: "Selene Labs",
    detail:
      "Kauft die klügsten verfügbaren Köpfe und richtet ihren Blick auf den Weg aus dem Sonnensystem.",
    source: "official-wording",
  },
  {
    term: "Dark Side",
    detail:
      "Setzt Geld aus Biotechnologie und erweiterter Realität auf Transhumanismus: Verbessere die Besatzung, bevor du das Schiff verbesserst.",
    source: "official-wording",
  },
  {
    term: "Imbrium",
    detail:
      "Ein Industriekartell auf dem alten imperialen Weg: mit Industrie oder Handel zur mächtigsten Macht werden.",
    source: "official-wording",
  },
  {
    term: "The Oasis",
    detail:
      "Macht den Mond zu einer zweiten Heimat für alles Leben auf der Erde, Tiere und Pflanzen eingeschlossen – besonders für jene, denen hier unten der Platz ausgeht.",
    source: "official-wording",
  },
];

export const purchase = {
  productName: "{productName}",
  availability: "Auf Lager",
  notes: [
    {
      term: "Verfügbarkeit",
      detail:
        "Auf Lager, und das bleibt so. Wir führen keinen Lagerzähler; auf dieser Seite wird dich deshalb nie etwas zur Eile drängen.",
      source: "stock-policy",
    },
    { term: "Versand", detail: "Versand innerhalb von 3 Werktagen.", source: "dispatch-window" },
    {
      term: "Einfuhrabgaben",
      detail:
        "Außerhalb der EU erhebt das Zielland Einfuhrabgaben und Bearbeitungsgebühren bei Ankunft. Sie sind von der empfangenden Person zu bezahlen.",
      source: "duties-outside-eu",
    },
  ] satisfies readonly ListItem[],
  callsToAction: [
    { label: "In den Warenkorb", emphasis: "primary", target: { kind: "route", to: "cart" } },
    {
      label: "Versand und Rückgabe",
      emphasis: "quiet",
      target: { kind: "route", to: "legalShipping" },
    },
  ] satisfies readonly CallToAction[],
} as const;

export const productFaq: readonly FaqEntry[] = [
  {
    question: "Wie viel kostet der Versand?",
    answer: [
      "Die Versandkosten und die Steuern werden an der Kasse anhand deiner Lieferadresse berechnet. Der Preis des Spiels vor Steuern ist überall gleich; was sich ändert, sind die Zuschläge: {priceLine}",
    ],
    source: "shipping-charge",
  },
  {
    question: "Wohin liefert ihr?",
    answer: [
      "Überallhin. Bestellungen werden innerhalb von 3 Werktagen verschickt. Innerhalb der EU dauert die Lieferung gewöhnlich 3 bis 7 Werktage, anderswo 7 bis 21.",
    ],
    source: "delivery-estimates",
  },
  {
    question: "Kann ich das Spiel zurückgeben?",
    answer: [
      "Ja. Ab dem Tag, an dem das Paket ankommt, hast du 14 Tage Zeit, uns deinen Widerruf mitzuteilen, und weitere 14 Tage für die Rücksendung.",
    ],
    source: "withdrawal-terms",
  },
  {
    question: "Gibt es eine englische Spielanleitung?",
    answer: [
      "Die Spielanleitung in der Schachtel ist auf Englisch. Dieselbe Anleitung findest du auch auf dieser Website, wenn du sie vor dem Kauf lesen möchtest.",
    ],
    source: "rulebook",
  },
  {
    question: "Funktioniert das Spiel zu zweit? Und zu sechst?",
    answer: [
      "Beides, und die Partien fühlen sich deutlich unterschiedlich an. Zu zweit liegen fünf Karten in der Auslage (Supply), und dir sitzt nur eine andere Basis gegenüber: Es spielt sich wie ein Duell, und du siehst meist, worauf dein Gegenüber hinarbeitet.",
      "Zu sechst liegen neun Karten in der Auslage, und fünf andere Basen stehen deiner gegenüber. Agentenkarten (Agent) haben daher viel mehr Ziele. Sechs ist die Obergrenze, für die das Spiel entworfen wurde – keine Zahl am Rand seiner Möglichkeiten.",
    ],
    source: "rulebook",
  },
];

export const productSafety = {
  heading: "Hersteller und Produktsicherheit",
  manufacturer: {
    heading: "Hersteller",
    body: [
      "{merchantLegalName}, {merchantRegisteredAddress}.",
      "E-Mail: {merchantContactAddress}. Telefon: {merchantPhoneNumber}.",
      "{merchantLegalName} lässt dieses Spiel nach eigenen Vorgaben herstellen und verkauft es unter eigenem Namen. Damit ist das Unternehmen Hersteller im Sinne des EU-Produktsicherheitsrechts. Longpack Co., Ltd. in Shanghai, China, ist der beauftragte Produzent, der das Spiel druckt und zusammenstellt; der beauftragte Produzent ist nicht der Hersteller.",
    ],
  },
  safety: {
    heading: "Sicherheitshinweise",
    body: [
      "Die Altersangabe in den Spielangaben oben ist eine Sicherheitskennzeichnung für dieses Produkt, keine Spielempfehlung. Das steht dahinter.",
      "Intertek Testing Services Ltd. in Shanghai prüfte das Spiel auf die europäischen Normen für Spielzeugsicherheit. Laut Prüfbericht SHAH01338706 vom 14. Mai 2021 bestand es alle darin aufgeführten Prüfungen. Die Ergebnisse gelten für die aktuell verkauften Exemplare: Seitdem gab es keine weitere Auflage.",
    ],
    results: [
      {
        term: "EN71-1:2014+A1:2018",
        detail: "Mechanische und physikalische Eigenschaften – bestanden.",
        source: "E16",
      },
      { term: "EN71-2:2020", detail: "Entflammbarkeit – bestanden.", source: "E16" },
      {
        term: "EN71-3:2019",
        detail: "Migration bestimmter Elemente – bestanden.",
        source: "E16",
      },
      {
        term: "EN71-3:2019 gemäß Verordnung (EU) 2019/1922",
        detail:
          "Änderung der Richtlinie 2009/48/EG zur Aluminiummigration – bestanden.",
        source: "E16",
      },
    ] satisfies readonly ListItem[],
  },
} as const;
