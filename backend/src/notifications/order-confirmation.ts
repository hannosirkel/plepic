export const ORDER_CONFIRMATION_TEMPLATE = "order-confirmation";

import type { OrderConfirmationLegalConfig } from "../config/runtime.js";

interface OrderConfirmationItem {
  readonly title: string;
  readonly quantity: number;
}

interface OrderConfirmationOrder {
  readonly display_id: number | string;
  readonly currency_code: string;
  readonly total: number;
  readonly items: readonly OrderConfirmationItem[];
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatTotal(total: number, currencyCode: string): string {
  const currency = currencyCode.toUpperCase();
  const amount = new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(total);

  return `${amount.replace(/\u00a0/g, "")} ${currency}`;
}

/*
 * Canonical wording is content/legal/returns.ts. The backend image cannot import
 * across its package root, so the exact-paragraph test compares these sections
 * with that source and makes any future wording drift fail closed.
 */
export const ORDER_CONFIRMATION_LEGAL_SECTIONS = [
  {
    heading: "You have 14 days to change your mind",
    paragraphs: [
      "If you are buying as a consumer, you may withdraw from the contract without giving any reason.",
      "The withdrawal period is 14 days from the day you, or somebody you nominated other than the carrier, take physical possession of the goods.",
      "To withdraw, tell us so before the 14 days are up. Email {merchantContactAddress} with your order number and a sentence saying you are withdrawing — that is enough. You may use the model withdrawal form below if you prefer, but you are not obliged to. Simply sending the parcel back without telling us also works, but a message is faster and lets us watch for the return.",
      "The statutory 14 days for the refund run from the day you tell us; if the parcel is your only message, the refund clock starts when it, or your proof of postage, reaches us.",
    ],
  },
  {
    heading: "Model withdrawal form",
    paragraphs: [
      "Model withdrawal form (use only if you wish):",
      "To {merchantLegalName}, {merchantRegisteredAddress}, {merchantContactAddress}: I hereby give notice that I withdraw from my contract of sale of the following goods: …",
      "Ordered on / received on: …",
      "Name and address of consumer: …",
      "Signature (only if on paper), date.",
    ],
  },
  {
    heading: "Sending it back, and getting your money",
    paragraphs: [
      "Send the goods back within 14 days of telling us you are withdrawing. The return address is {returnAddress}.",
      "You pay the cost of returning the parcel. Please use a tracked service and keep your proof of postage — once you show it to us, your refund is due even if the parcel is still travelling — and choose the cheapest service that offers tracking; we do not ask for anything more than that.",
      "We refund what you paid for the goods, plus the standard outbound delivery charge, within 14 days of being told you are withdrawing. If you chose a faster or more expensive delivery option than our standard one, we refund the standard cost rather than the premium. We may hold the refund until the goods reach us, or until you show us proof of postage, whichever happens first.",
      "The refund goes back by the same means you paid, and costs you nothing.",
      "You may unwrap the game and look at it — that is what you would do in a shop. If the components come back damaged or incomplete because of handling beyond checking what the game is, we may reduce the refund by the loss in value.",
      "None of this affects your separate legal rights if the goods arrive faulty, damaged or not as described. If a card is missing or the box arrived crushed, write to {merchantContactAddress} and we will put it right; do not use the withdrawal process for that.",
    ],
  },
] as const;

function resolveLegalParagraph(
  paragraph: string,
  legal: OrderConfirmationLegalConfig,
): string {
  return paragraph
    .replaceAll("{merchantLegalName}", legal.merchantLegalName)
    .replaceAll("{merchantRegisteredAddress}", legal.merchantRegisteredAddress)
    .replaceAll("{merchantContactAddress}", legal.merchantContactAddress)
    .replaceAll("{returnAddress}", legal.returnAddress);
}

export function renderOrderConfirmation(
  order: OrderConfirmationOrder,
  legal: OrderConfirmationLegalConfig,
) {
  const heading = `Order #${order.display_id} confirmed`;
  const lines = order.items.map((item) => `${item.quantity} × ${item.title}`);
  const htmlItems = order.items
    .map((item) => `<li>${item.quantity} × ${escapeHtml(item.title)}</li>`)
    .join("");
  const total = formatTotal(order.total, order.currency_code);
  const legalText = ORDER_CONFIRMATION_LEGAL_SECTIONS.map((section) => [
    section.heading,
    ...section.paragraphs.map((paragraph) => resolveLegalParagraph(paragraph, legal)),
  ].join("\n\n")).join("\n\n");
  const legalHtml = ORDER_CONFIRMATION_LEGAL_SECTIONS.map((section) =>
    `<h2>${escapeHtml(section.heading)}</h2>${section.paragraphs
      .map((paragraph) => `<p>${escapeHtml(resolveLegalParagraph(paragraph, legal))}</p>`)
      .join("")}`,
  ).join("");

  return {
    subject: heading,
    text: `${heading}\n\n${lines.join("\n")}\n\nTotal: ${total}\n\n${legalText}`,
    html: `<h1>${heading}</h1><ul>${htmlItems}</ul><p>Total: ${total}</p>${legalHtml}`,
  };
}
