/**
 * Basket and checkout copy — the German edition of `../shop.ts`.
 *
 * This file is a translation, not a revision. Exports, keys, field names, form
 * tokens, link targets and placeholders are those of the English module; only
 * prose is German. The English module records why each string says what it
 * says, and that reasoning is not repeated here.
 *
 * **Staged, not published.** The `de` entry of `siteCopyByLocale` is still
 * `null`, so no visitor can reach this copy; registering it is a later task
 * of the same plan. Until then `content/mirror.test.ts` and the scans of
 * `content/content.test.ts` read this file from disk.
 *
 * ## What is not here, as in English
 *
 * The sentences the checkout is legally obliged to say are read out of the
 * German legal pages by `storefront/src/components/shop/checkout-terms.ts`.
 * They are not copied into this file, and no amount of money is written here.
 *
 * ## The order button's label
 *
 * `orderButtonLabel` is „Jetzt bezahlen“: the German of "Pay now", and the
 * gloss `content/legal/de/terms.ts` already gives for the label. That page
 * still quotes the English label, because a German reader's checkout is the
 * English one until this module is registered. **The task that registers it
 * changes that sentence to quote „Jetzt bezahlen“ in the same commit**, as the
 * page's own header requires.
 *
 * ## Address
 *
 * The reader is addressed as „du“, as `docs/working/site-translation/de.md`
 * sets outside the legal pages. One paragraph says „Sie“:
 * `checkout.beforeYouOrder.withdrawalBody`. It stands between two sentences
 * the checkout reads from the legal pages, which say „Sie“, and it states the
 * same right they do. The link labels that both the basket and that block
 * show name no reader at all.
 *
 * ## Words that agree with the German legal pages
 *
 * - „Warenkorb“, „Kasse“, „Paketautomat“ and „Widerruf“ are the glossary's
 *   shop terms and the ones the legal pages use.
 * - The six disclosures above the order button carry the names
 *   `content/legal/de/terms.ts` lists them under: „die Ware“, „Preis der
 *   Ware“, „Versandkosten“, „Gesamtbetrag“, „Lieferadresse“ and
 *   „voraussichtliche Lieferzeit“.
 * - A link to a legal page carries that page's title: „Versand und
 *   Lieferung“, „Verkaufsbedingungen“, „Muster-Widerrufsformular“. The terms
 *   page calls the privacy page „Datenschutzerklärung“.
 * - „Lieferziel“, „Versandart“, „Mehrwertsteuer“, and „Wir versenden in jedes
 *   Land.“ are the shipping page's.
 * - „liefern“ is what the terms page says of an item the shop cannot supply.
 *   „abgebucht“ is money that has left an account.
 */

import type { CallToAction, Link } from "../schema.js";
import type { AddressFieldCopy, PhoneFieldCopy } from "../shop.js";

/**
 * The German of the four formulations the English list holds, in its order:
 * the wording of Article 8(2) of the Consumer Rights Directive in its German
 * text, then "buy now", "pay now" and "confirm purchase". Lower case, because
 * the comparison is case-insensitive. `checkout.orderButtonLabel` below is a
 * member, as the English label is of the English list.
 */
export const COMPLIANT_ORDER_BUTTON_LABELS: readonly string[] = [
  "zahlungspflichtig bestellen",
  "jetzt kaufen",
  "jetzt bezahlen",
  "kauf bestätigen",
];

export const unavailableFigure = "Wird angezeigt, sobald dein Warenkorb nur Artikel enthält, die wir liefern können";

export const basket = {
  heading: "Dein Warenkorb",
  lede: "Ein Spiel, ein Preis vor Steuern, Versand in jedes Land. Steuer und Versand werden an der Kasse berechnet – anhand der Lieferadresse, die du dort eingibst.",

  empty: {
    heading: "Dein Warenkorb ist leer",
    body: "Noch liegt nichts darin.",
    addLabel: "{productName} in den Warenkorb legen",
    browse: {
      label: "Erst mehr über das Spiel lesen",
      emphasis: "quiet",
      target: { kind: "route", to: "lunarBase" },
    } satisfies CallToAction,
  },

  linesHeading: "Was du kaufst",
  columns: {
    item: "Artikel",
    unitPrice: "Preis",
    quantity: "Menge",
    lineTotal: "Summe",
    actions: "Ändern",
  },
  quantityLabel: "Menge",
  quantityAccessibleLabel: "Menge von {productName}",
  updateLabel: "Aktualisieren",
  updateAccessibleLabel: "Menge von {productName} aktualisieren",
  removeLabel: "Entfernen",
  removeAccessibleLabel: "{productName} aus deinem Warenkorb entfernen",
  updatingLabel: "Menge wird aktualisiert…",
  addingLabel: "Wird in deinen Warenkorb gelegt…",
  removingLabel: "Artikel wird entfernt…",

  /**
   * Composed at render with the two limits, as in English:
   * „Gib die Anzahl der Exemplare als ganze Zahl von 1 bis 10 ein. Dein
   * Warenkorb wurde nicht geändert.“ The verb closes the sentence, so it is
   * in `suffix`.
   */
  quantityError: {
    prefix: "Gib die Anzahl der Exemplare als ganze Zahl von ",
    rangeSeparator: " bis ",
    suffix: " ein. Dein Warenkorb wurde nicht geändert.",
  },

  /** Composed at render with the limit, as in English. */
  limitError: {
    prefix: "Eine Bestellung kann höchstens ",
    suffix: " Exemplare enthalten, und so viele liegen bereits in deinem Warenkorb. Es wurde nichts hinzugefügt.",
  },

  unavailableLabel: "Nicht verfügbar",
  unavailableNote:
    "Das können wir im Moment nicht liefern, deshalb lässt sich für deinen Warenkorb kein Preis angeben. Entferne den Artikel, um fortzufahren.",

  summary: {
    heading: "Bestellübersicht",
    goodsLabel: "Ware",
    shippingLabel: "Versand",
    shippingPending: "Wird an der Kasse berechnet",
    totalLabel: "Gesamtbetrag",
    totalPending: "Wird an der Kasse angezeigt",
  },

  checkout: {
    label: "Zur Kasse",
    emphasis: "primary",
    target: { kind: "route", to: "checkout" },
  } satisfies CallToAction,

  beforeYouBuy: {
    heading: "Vor dem Kauf",
    body: [
      "Lieferung, Rücksendungen und das Recht, es dir anders zu überlegen, kannst du nachlesen, bevor du bestellst – nicht erst danach.",
    ],
    links: [
      { label: "Versand und Lieferung", target: { kind: "route", to: "legalShipping" } },
      {
        label: "Rücksendungen und 14-tägiges Widerrufsrecht",
        target: { kind: "route", to: "legalReturns", anchor: "withdrawal" },
      },
      {
        label: "Muster-Widerrufsformular",
        target: { kind: "route", to: "legalReturns", anchor: "withdrawal-form" },
      },
      { label: "Verkaufsbedingungen", target: { kind: "route", to: "legalTerms" } },
    ] satisfies readonly Link[],
  },
} as const;

export const checkout = {
  heading: "Kasse",
  lede: "Lieferadresse, Versand und Zahlung. Es wird nichts abgebucht, bis du die Schaltfläche zum Bestellen betätigst.",

  empty: {
    heading: "Dein Warenkorb ist leer",
    body: "Es gibt nichts zu bestellen.",
    link: {
      label: "Zurück zu deinem Warenkorb",
      emphasis: "secondary",
      target: { kind: "route", to: "cart" },
    } satisfies CallToAction,
  },

  address: {
    heading: "Lieferadresse",
    body: "Wohin das Paket geht und wohin die Bestätigung geschickt wird.",
    fields: [
      {
        name: "fullName",
        label: "Vollständiger Name",
        control: "input",
        type: "text",
        autoComplete: "name",
        inDeliveryAddress: true,
      },
      {
        name: "streetAddress",
        label: "Straße und Hausnummer",
        control: "input",
        type: "text",
        autoComplete: "street-address",
        inDeliveryAddress: true,
      },
      {
        name: "postalCode",
        label: "Postleitzahl",
        control: "input",
        type: "text",
        autoComplete: "postal-code",
        inDeliveryAddress: true,
      },
      {
        name: "city",
        label: "Ort",
        control: "input",
        type: "text",
        autoComplete: "address-level2",
        inDeliveryAddress: true,
      },
      {
        name: "country",
        label: "Land",
        control: "country",
        type: "text",
        autoComplete: "country-name",
        inDeliveryAddress: true,
        hint: "Wir versenden in jedes Land.",
      },
      {
        name: "email",
        label: "E-Mail-Adresse",
        control: "input",
        type: "email",
        autoComplete: "email",
        inDeliveryAddress: false,
        hint: "Dorthin geht deine Bestellbestätigung.",
      },
    ] satisfies readonly AddressFieldCopy[],
    countryUnchosen: "Land wählen",
    missingValue: "Gib oben deine Lieferadresse ein.",
    phone: {
      label: "Telefonnummer",
      hint: "Außerhalb von Estland, Finnland, Litauen und Lettland erforderlich, dort freiwillig. Omniva schickt darüber – oder über deine E-Mail-Adresse – die Benachrichtigungen zu Zustellung und Abholung.",
      autoComplete: "tel",
    } satisfies PhoneFieldCopy,
  },

  delivery: {
    heading: "Lieferung",
    methodLabel: "Versandart",
    chargeLabel: "Versand",
    chargePending: "Gib deine Lieferadresse ein, um die Versandkosten zu sehen.",
    estimateLabel: "Voraussichtliche Lieferzeit",
    parcelMachineLabel: "Paketautomat",
    parcelMachinePrompt: "Paketautomaten wählen",
    parcelMachineLoading: "Paketautomaten werden geladen…",
    parcelMachineUnavailable:
      "Die Liste der Paketautomaten konnte nicht geladen werden. Wähle eine andere Versandart oder versuche es noch einmal.",
  },

  payment: {
    heading: "Zahlung",
    cardRegionLabel: "Zahlungsdaten",
    cardRegionBody:
      "Das sichere Zahlungsformular erscheint, nachdem du eine Versandart gewählt hast. Welche Zahlungsarten verfügbar sind, hängt von deinem Gerät, deinem Standort und der Stripe-Konfiguration ab.",
  },

  beforeYouOrder: {
    heading: "Vor der Bestellung",
    returnPostageLabel: "Rücksendung",
    withdrawalLabel: "Es sich anders überlegen",
    // „Sie“, unlike the rest of this file: see the header, under Address.
    withdrawalBody:
      "Sie haben ab Lieferung 14 Tage Zeit, den Vertrag zu widerrufen, mit oder ohne Angabe von Gründen. Die Bedingungen und das Muster-Widerrufsformular finden Sie hier; sie waren von jeder Seite aus erreichbar, die Sie gesehen haben.",
    links: [
      {
        label: "Rücksendungen und 14-tägiges Widerrufsrecht",
        target: { kind: "route", to: "legalReturns", anchor: "withdrawal" },
      },
      {
        label: "Muster-Widerrufsformular",
        target: { kind: "route", to: "legalReturns", anchor: "withdrawal-form" },
      },
      { label: "Verkaufsbedingungen", target: { kind: "route", to: "legalTerms" } },
      { label: "Datenschutzerklärung", target: { kind: "route", to: "legalPrivacy" } },
      { label: "Versand und Lieferung", target: { kind: "route", to: "legalShipping" } },
    ] satisfies readonly Link[],
  },

  /**
   * The six disclosures, under the names `content/legal/de/terms.ts` lists
   * them by, and the VAT row between the shipping charge and the total.
   */
  order: {
    heading: "Deine Bestellung",
    goodsLabel: "Die Ware",
    goodsPriceLabel: "Preis der Ware",
    shippingLabel: "Versandkosten",
    vatLabel: "{vatRate} Mehrwertsteuer",
    destinationProvisional:
      "Diese Beträge richten sich nach dem auf dieser Website eingestellten Lieferziel, bis die Lieferadresse oben vollständig ist; maßgeblich ist die Adresse.",
    qualifierPending:
      "Mehrwertsteuer und Versand werden anhand der Lieferadresse oben berechnet und hier angezeigt, sobald sie vollständig ist. Steuern und Zölle von Ländern außerhalb der EU, falls welche anfallen, sind nicht enthalten.",
    totalLabel: "Gesamtbetrag",
    addressLabel: "Lieferadresse",
    estimateLabel: "Voraussichtliche Lieferzeit",
    totalPending: "Wird angezeigt, sobald deine Lieferadresse vollständig ist",
  },

  /** A member of {@link COMPLIANT_ORDER_BUTTON_LABELS}. See the header. */
  orderButtonLabel: "Jetzt bezahlen",
  placingLabel: "Deine Bestellung wird aufgegeben…",

  errors: {
    heading: "Prüfe deine Angaben",
    /**
     * No component composes a sentence from these two any more: the checkout
     * says the whole sentences of `checkout.missing` in `interface.ts`. They
     * are written to stand before a field's label all the same, since
     * „Gib … ein“ would have to close after it.
     */
    missingFieldPrefix: "Bitte eingeben: ",
    missingSelectionPrefix: "Bitte wählen: ",
    invalidEmail: "Gib eine E-Mail-Adresse ein, an die wir deine Bestätigung senden können.",
    invalidPhone:
      "Gib eine Telefonnummer ein, die mit der Ländervorwahl beginnt, zum Beispiel +372 5555 5555.",
    unavailableLine: "Entferne vor dem Bestellen den Artikel, den wir nicht liefern können.",
    paymentNotConnected:
      "Es wurde keine Bestellung aufgegeben und nichts abgebucht: Die Kartenzahlung ist auf dieser Website noch nicht angebunden.",
    actionFailed: "Das hat nicht geklappt. Es hat sich nichts geändert. Versuche es gleich noch einmal.",
    orderFailed: "Wir konnten deine Bestellung nicht aufgeben. Es wurde nichts abgebucht. Versuche es gleich noch einmal.",
  },
} as const;
