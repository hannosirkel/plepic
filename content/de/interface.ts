/**
 * Interface copy — the German edition of `../interface.ts`: the strings the
 * components write, from the destination selector to the 404 page.
 *
 * This file is a translation, not a revision. The keys and every placeholder,
 * in braces or between percent signs, are those of the English module, which
 * also says what each string is for; only prose is German. Anything believed wrong in the English is a
 * finding against the English, never a thing to fix here first.
 *
 * Published under `/de` through `siteCopyByLocale`. The mirror and content
 * scans continue to check this file.
 *
 * The reader is addressed as „du“, as `docs/working/site-translation/de.md`
 * sets outside the legal pages.
 *
 * ## Sentences a component builds from several strings
 *
 * - `paymentReturn.returnToCheckout` is a link inside the sentence that
 *   `loadFailedBeforeLink` and `loadFailedAfterLink` enclose, and also a link
 *   that stands alone. It is therefore a complete label, and the sentence
 *   closes after a dash and not with a clause the label would have to open.
 * - `consent.privacyLink` sits between `introduction` and `conclusion`. The
 *   component puts the spaces around it.
 * - `product.videoPendingSuffix` follows a video's title, so it opens with a
 *   space and a verb.
 * - The form errors are whole sentences, one per field, for the reason the
 *   English module gives: „Gib … ein“ closes after its object and cannot be
 *   built from a prefix and a label.
 *
 * ## Words that agree with the German legal pages
 *
 * - „Kasse“, „Warenkorb“ and „Paketautomat“ are the glossary's shop terms.
 * - „Standardversand“ and „Omniva-Paketautomat“ are the names
 *   `content/legal/de/shipping.ts` gives the two delivery methods, and
 *   „Versandart“ is its word for a method.
 * - „Lieferziel“ is the destination a price is shown for, as on the shipping
 *   and privacy pages. „berechnet“ is what the visitor is charged, as there;
 *   „abgebucht“ is money that has left an account.
 * - „Sicherheitsabfrage“ is the privacy page's word for the verification
 *   challenge.
 * - „Mehrwertsteuer“ is written out, as on the shipping page.
 */

import type { InterfaceCopy } from "../interface.js";

export const interfaceCopy: InterfaceCopy = {
  destinationSelector: {
    label: "Lieferziel",
    hint: "Das Lieferziel entscheidet, welcher Preis angezeigt wird, nicht, was dir berechnet wird. Berechnet wird nach der Lieferadresse, die du an der Kasse bestätigst.",
    updatingPrice: "Preis wird aktualisiert…",
  },
  home: {
    heroImageAlt:
      "Vorder- und Rückseite der Schachtel von Lunar Base: vorn das Titelbild mit dem Astronauten, hinten die Übersicht über Spielmaterial und Spiel.",
    proofSectionLabel: "Belege",
    featuredCallToActionLabel: "Lunar Base entdecken",
    featuredImageAlt: "Eine aufgefächerte Hand mit Karten aus Lunar Base.",
    teamPhotoAlt:
      "Die sechs Menschen, die Plepic Games ausmachen, gemeinsam in einem Innenraum fotografiert; vor ihnen auf dem Tisch stehen Schachteln von Lunar Base.",
  },
  reviews: {
    quotationOpen: "„",
    quotationClose: "“",
    contextSeparator: " – ",
  },
  newsletterForm: {
    emailMissing: "Gib deine E-Mail-Adresse ein.",
    emailInvalid: "Gib eine gültige E-Mail-Adresse ein.",
  },
  contactForm: {
    nameMissing: "Gib deinen Namen ein.",
    emailMissing: "Gib deine E-Mail-Adresse ein.",
    emailInvalid: "Gib eine gültige E-Mail-Adresse ein.",
    subjectMissing: "Gib an, worum es geht.",
    messageMissing: "Gib eine Nachricht ein.",
  },
  forms: {
    verificationLabel: "Sicherheitsabfrage",
  },
  support: {
    faqHeading: "Häufig gestellte Fragen",
  },
  rulebook: {
    heading: "Spielanleitung zu Lunar Base",
    lede: "Die vollständige Spielanleitung auf Deutsch, gesetzt wie die gedruckte englische Anleitung aus der Schachtel – 25 Seiten, mit Tags versehen und mit markierbarem Text statt als Scan, sodass du sie durchsuchen, daraus kopieren und sie mit einem Screenreader lesen kannst.",
    openLabel: "Spielanleitung öffnen (PDF)",
    downloadNote: "Der Download ist %megabytes% MB groß – gut zu wissen, bevor du ihn auf dem Handy antippst.",
    otherLanguagesHeading: "Auch erhältlich auf",
    languageSize: "%megabytes% MB",
  },
  product: {
    boxImageAlt: "Die geöffnete Schachtel von Lunar Base vor schlichtem Hintergrund, der Deckel hinter dem leeren Einsatz aufgestellt; davor ein sauber ausgerichteter Stapel Karten, auf dem die Shackleton-Hauptaktionskarte (Main Action) liegt, eine kleine Kartenschachtel, die aufgeschlagen stehende Spielanleitung und mehrere runde Zählscheiben.",
    victoryHeading: "Vier Wege zum Sieg",
    boxHeading: "Was in der Schachtel steckt",
    cardsImageAlt: "Eine aufgefächerte Hand mit Karten aus Lunar Base.",
    baseImageAlt: "Die ausgelegte Basis einer Person: eine Station mit mehreren angelegten Modulkarten.",
    factionsSummary: "Die sechs Fraktionen",
    tableHeading: "Auf dem Tisch",
    tableImageAlt: "Eine vollständige Partie Lunar Base in vollem Gang, von oben gesehen: sechs verzweigte Basen der Spielenden und Karten rund um die gemeinsame Spielfläche.",
    watchHeading: "Ansehen",
    trailerHeading: "Trailer",
    trailerTitle: "Lunar Base – Video zum Kickstarter-Start",
    tutorialHeading: "Erklärvideo",
    tutorialTitle: "Lunar Base – Erklärvideo und Beispielpartie",
    reviewsHeading: "Was Rezensionen sagen",
    questionsHeading: "Versand, Rückgabe und weitere Fragen",
    buyAccessibleLabel: "{productName} kaufen",
    safetyIncompleteSingle: "Diese Herstellerangaben sind unvollständig: %missing% wurde für diese Bereitstellung nicht konfiguriert.",
    safetyIncompletePlural: "Diese Herstellerangaben sind unvollständig: %missing% wurden für diese Bereitstellung nicht konfiguriert.",
    videoPendingSuffix: " ist noch nicht verlinkt – das Video wird von YouTube eingebettet, sobald eine veröffentlichte Video-ID konfiguriert ist.",
    outOfStock: "Nicht auf Lager",
    playerCount: "%min%–%max% Personen",
    addingToBasket: "Wird in den Warenkorb gelegt…",
    retryAddingToBasket: "Noch einmal in den Warenkorb legen",
    basketExpired: "Der Warenkorb ist abgelaufen; leg das Spiel noch einmal hinein",
    playOnline: {
      heading: "Online spielen",
      body: "Spiel Lunar Base kostenlos im Browser – gegen andere oder gegen den Computer. Ein Konto brauchst du nicht. Das Online-Spiel ist auf Englisch.",
      linkLabel: "Lunar Base online spielen",
    },
  },
  checkout: {
    missing: {
      fullName: "Gib deinen vollständigen Namen ein.",
      streetAddress: "Gib Straße und Hausnummer ein.",
      postalCode: "Gib die Postleitzahl ein.",
      city: "Gib den Ort ein.",
      country: "Wähle ein Land.",
      email: "Gib die E-Mail-Adresse ein.",
      phone: "Gib die Telefonnummer ein.",
    },
    deliveryMethodPrompt: "Versandart wählen",
    deliveryOptionsLoading: "Versandarten werden aktualisiert…",
    deliveryOptionsFailed: "Die Versandarten konnten nicht geladen werden. Prüfe die Adresse und versuche es noch einmal.",
    deliveryFree: "Kostenlos",
    deliveryNetCharge: "%amount% zzgl. Mehrwertsteuer",
    paymentUnavailable: "Die Zahlung ist nicht verfügbar. Bitte versuche es später noch einmal.",
    paymentAwaitingDelivery: "Wähle eine Versandart, damit die Zahlungsarten geladen werden.",
    paymentOptionsLoading: "Zahlungsarten werden geladen…",
    paymentOptionsFailed: "Die Zahlungsarten konnten nicht geladen werden.",
    paymentOptionsNotReady: "Die Zahlungsarten sind noch nicht bereit. Warte einen Moment und versuche es noch einmal.",
    paymentFormLoading: "Die Zahlungsarten werden noch geladen",
    paymentNotConfirmed: "Die Zahlung konnte nicht bestätigt werden. Prüfe die Angaben oder wähle eine andere Zahlungsart.",
    paymentProcessing: "Die Zahlung wird noch verarbeitet. Wir prüfen den Status der Bestellung.",
    paymentNotCompleted: "Die Zahlung konnte nicht abgeschlossen werden. Es wurde nichts abgebucht.",
    verificationIncomplete: "Löse die Sicherheitsabfrage, bevor du die Bestellung aufgibst.",
    confirmedHeading: "Bestellung bestätigt",
    confirmedBody: "Deine Bestellnummer lautet %orderNumber%. Eine Bestätigung kommt per E-Mail.",
  },
  deliveryMethodNames: {
    standard: "Standardversand",
    "omniva-parcel-machine": "Omniva-Paketautomat",
  },
  paymentReturn: {
    heading: "Bestellung abschließen",
    loading: "Deine Bestelldaten werden geladen…",
    loadFailedBeforeLink: "Wir konnten deine aktuellen Bestelldaten nicht laden. ",
    loadFailedAfterLink: " – versuche es danach noch einmal.",
    returnToCheckout: "Zurück zur Kasse",
    verificationInstruction: "Löse eine neue Sicherheitsabfrage, um deine Bestellung abzuschließen.",
    completing: "Bestellung wird abgeschlossen…",
    completionFailed: "Prüfe deinen Warenkorb, bevor du es noch einmal versuchst. Eine Bestellung wird erst angezeigt, nachdem der Shop sie bestätigt hat.",
  },
  consent: {
    reopenLabel: "Deine Datenschutz-Auswahl ändern",
    choicesLabel: "Datenschutz-Auswahl",
    dialogLabel: "Einwilligung in Cookies und Analyse",
    introduction: "Wir nutzen Google Analytics, um zu sehen, wie die Website genutzt wird – und erst, wenn du zustimmst. Auf der",
    privacyLink: "Datenschutzseite",
    conclusion: "stehen die Rechtsgrundlage und alle, die dabei mit Daten umgehen.",
    agree: "Zustimmen",
    decline: "Ablehnen",
  },
  notFound: {
    title: "Seite nicht gefunden",
    body: "Unter dieser Adresse gibt es auf dieser Website keine Seite.",
    homeLink: "Zur Startseite",
  },
};
