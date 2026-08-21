import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import {
  ContainerRegistrationKeys,
  Modules,
  tryConvertToNumber,
} from "@medusajs/framework/utils";

import {
  ORDER_CONFIRMATION_TEMPLATE,
  renderOrderConfirmation,
} from "../notifications/order-confirmation.js";

interface OrderPlacedEvent {
  readonly id: string;
}

interface QueriedOrderItem {
  readonly title?: string | null;
  readonly unit_price?: unknown;
  readonly total?: unknown;
  readonly tax_total?: unknown;
  readonly detail?: { readonly quantity?: unknown } | null;
}

interface ConfirmationOrderItem {
  readonly title: string;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly lineTotal: number;
  readonly lineTaxTotal: number;
}

interface QueriedShippingAddress {
  readonly first_name?: unknown;
  readonly last_name?: unknown;
  readonly company?: unknown;
  readonly address_1?: unknown;
  readonly address_2?: unknown;
  readonly postal_code?: unknown;
  readonly city?: unknown;
  readonly province?: unknown;
  readonly country_code?: unknown;
}

function finiteNumber(value: unknown): number | null {
  if (typeof value !== "number" && (typeof value !== "object" || value === null)) {
    return null;
  }

  const converted = tryConvertToNumber(value);
  return typeof converted === "number" && Number.isFinite(converted) ? converted : null;
}

function nonNegativeNumber(value: unknown): number | null {
  const converted = finiteNumber(value);
  return converted !== null && converted >= 0 ? converted : null;
}

function currencyPrecision(currencyCode: string): number | null {
  try {
    const precision = new Intl.NumberFormat("en-IE", {
      style: "currency",
      currency: currencyCode,
    }).resolvedOptions().maximumFractionDigits;
    return typeof precision === "number" && Number.isInteger(precision) && precision >= 0
      ? precision
      : null;
  } catch {
    return null;
  }
}

function currencyUnits(value: number, precision: number): number | null {
  const rounded = Number(new Intl.NumberFormat("en-US", {
    useGrouping: false,
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  }).format(value));
  const units = Math.round(rounded * 10 ** precision);

  return Number.isSafeInteger(units) && units >= 0 ? units : null;
}

function sumCurrencyUnits(values: readonly number[]): number | null {
  const sum = values.reduce((total, value) => total + value, 0);
  return Number.isSafeInteger(sum) ? sum : null;
}

function addressValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function shippingAddressLines(address: QueriedShippingAddress | null | undefined): string[] {
  if (!address) return [];

  const name = [addressValue(address.first_name), addressValue(address.last_name)]
    .filter((value): value is string => value !== null)
    .join(" ");
  const postalCity = [addressValue(address.postal_code), addressValue(address.city)]
    .filter((value): value is string => value !== null)
    .join(" ");
  const countryCode = addressValue(address.country_code)?.toUpperCase() ?? "";

  return [
    name,
    addressValue(address.company),
    addressValue(address.address_1),
    addressValue(address.address_2),
    postalCity,
    addressValue(address.province),
    countryCode,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);
}

export default async function orderPlaced({
  event,
  container,
}: SubscriberArgs<OrderPlacedEvent>): Promise<void> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const notification = container.resolve(Modules.NOTIFICATION);
  const { data } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "email",
      "currency_code",
      "item_total",
      "item_tax_total",
      "shipping_total",
      "shipping_tax_total",
      "tax_total",
      "total",
      "items.id",
      "items.title",
      "items.unit_price",
      "items.total",
      "items.tax_total",
      "items.detail.quantity",
      "shipping_address.first_name",
      "shipping_address.last_name",
      "shipping_address.company",
      "shipping_address.address_1",
      "shipping_address.address_2",
      "shipping_address.postal_code",
      "shipping_address.city",
      "shipping_address.province",
      "shipping_address.country_code",
    ],
    filters: { id: event.data.id },
  });
  const order = data[0];
  const itemTotal = nonNegativeNumber(order?.item_total);
  const itemTaxTotal = nonNegativeNumber(order?.item_tax_total);
  const shippingTotal = nonNegativeNumber(order?.shipping_total);
  const shippingTaxTotal = nonNegativeNumber(order?.shipping_tax_total);
  const taxTotal = nonNegativeNumber(order?.tax_total);
  const total = nonNegativeNumber(order?.total);
  const shippingAddress = shippingAddressLines(order?.shipping_address);
  const currencyCode = typeof order?.currency_code === "string"
    ? order.currency_code.trim()
    : "";
  const precision = currencyCode.length > 0 ? currencyPrecision(currencyCode) : null;

  if (
    !order?.id ||
    typeof order.email !== "string" ||
    order.email.trim().length === 0 ||
    order.display_id == null ||
    String(order.display_id).trim().length === 0 ||
    currencyCode.length === 0 ||
    precision === null ||
    itemTotal === null ||
    itemTaxTotal === null ||
    shippingTotal === null ||
    shippingTaxTotal === null ||
    taxTotal === null ||
    total === null ||
    !Array.isArray(order.items) ||
    order.items.length === 0 ||
    shippingAddress.length === 0
  ) {
    throw new Error("Placed order is missing confirmation data");
  }

  const items: ConfirmationOrderItem[] = order.items.flatMap(
    (item: QueriedOrderItem | null) => {
      const quantity = finiteNumber(item?.detail?.quantity);
      const unitPrice = nonNegativeNumber(item?.unit_price);
      const lineTotal = nonNegativeNumber(item?.total);
      const lineTaxTotal = nonNegativeNumber(item?.tax_total);
      const title = item?.title?.trim();
      return title && quantity !== null && quantity > 0 && unitPrice !== null &&
        lineTotal !== null && lineTaxTotal !== null
        ? [{ title, quantity, unitPrice, lineTotal, lineTaxTotal }]
        : [];
    },
  );

  if (items.length !== order.items.length) {
    throw new Error("Placed order is missing confirmation item data");
  }

  const scale = 10 ** precision;
  const itemTotalUnits = currencyUnits(itemTotal, precision);
  const itemTaxTotalUnits = currencyUnits(itemTaxTotal, precision);
  const shippingTotalUnits = currencyUnits(shippingTotal, precision);
  const shippingTaxTotalUnits = currencyUnits(shippingTaxTotal, precision);
  const taxTotalUnits = currencyUnits(taxTotal, precision);
  const totalUnits = currencyUnits(total, precision);
  const itemSubtotalUnits = currencyUnits(itemTotal - itemTaxTotal, precision);
  const shippingSubtotalUnits = currencyUnits(
    shippingTotal - shippingTaxTotal,
    precision,
  );
  const normalizedItems = items.map((item) => ({
    ...item,
    totalUnits: currencyUnits(item.lineTotal, precision),
    taxTotalUnits: currencyUnits(item.lineTaxTotal, precision),
    subtotalUnits: currencyUnits(item.lineTotal - item.lineTaxTotal, precision),
  }));

  if (
    itemTotalUnits === null ||
    itemTaxTotalUnits === null ||
    shippingTotalUnits === null ||
    shippingTaxTotalUnits === null ||
    taxTotalUnits === null ||
    totalUnits === null ||
    itemSubtotalUnits === null ||
    shippingSubtotalUnits === null
  ) {
    throw new Error("Placed order confirmation totals do not reconcile");
  }

  const reconciledItems = normalizedItems.flatMap((item) =>
    item.totalUnits !== null && item.taxTotalUnits !== null && item.subtotalUnits !== null
      ? [{ ...item, totalUnits: item.totalUnits, taxTotalUnits: item.taxTotalUnits,
        subtotalUnits: item.subtotalUnits }]
      : []
  );

  if (
    reconciledItems.length !== normalizedItems.length ||
    sumCurrencyUnits(reconciledItems.map((item) => item.totalUnits)) !== itemTotalUnits ||
    sumCurrencyUnits(reconciledItems.map((item) => item.taxTotalUnits)) !== itemTaxTotalUnits ||
    sumCurrencyUnits(reconciledItems.map((item) => item.subtotalUnits)) !== itemSubtotalUnits ||
    itemTotalUnits + shippingTotalUnits !== totalUnits ||
    itemTaxTotalUnits + shippingTaxTotalUnits !== taxTotalUnits ||
    itemSubtotalUnits + shippingSubtotalUnits + taxTotalUnits !== totalUnits
  ) {
    throw new Error("Placed order confirmation totals do not reconcile");
  }

  const content = renderOrderConfirmation({
    displayId: order.display_id,
    currencyCode,
    itemSubtotal: itemSubtotalUnits / scale,
    shippingSubtotal: shippingSubtotalUnits / scale,
    taxTotal: taxTotalUnits / scale,
    total: totalUnits / scale,
    items: reconciledItems.map((item) => ({
      title: item.title,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: item.subtotalUnits / scale,
    })),
    shippingAddress,
  });

  await notification.createNotifications({
    to: order.email,
    channel: "email",
    template: ORDER_CONFIRMATION_TEMPLATE,
    content,
    trigger_type: "order.placed",
    resource_id: order.id,
    resource_type: "order",
    idempotency_key: `order-confirmation:${order.id}`,
  });
}

export const config: SubscriberConfig = {
  event: "order.placed",
};
