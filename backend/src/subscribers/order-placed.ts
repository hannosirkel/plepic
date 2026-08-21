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
  readonly subtotal?: unknown;
  readonly detail?: { readonly quantity?: unknown } | null;
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
      "item_subtotal",
      "shipping_subtotal",
      "tax_total",
      "total",
      "items.id",
      "items.title",
      "items.unit_price",
      "items.subtotal",
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
  const itemSubtotal = nonNegativeNumber(order?.item_subtotal);
  const shippingSubtotal = nonNegativeNumber(order?.shipping_subtotal);
  const taxTotal = nonNegativeNumber(order?.tax_total);
  const total = nonNegativeNumber(order?.total);
  const shippingAddress = shippingAddressLines(order?.shipping_address);

  if (
    !order?.id ||
    typeof order.email !== "string" ||
    order.email.trim().length === 0 ||
    order.display_id == null ||
    String(order.display_id).trim().length === 0 ||
    typeof order.currency_code !== "string" ||
    order.currency_code.trim().length === 0 ||
    itemSubtotal === null ||
    shippingSubtotal === null ||
    taxTotal === null ||
    total === null ||
    !Array.isArray(order.items) ||
    order.items.length === 0 ||
    shippingAddress.length === 0
  ) {
    throw new Error("Placed order is missing confirmation data");
  }

  const items = order.items.flatMap((item: QueriedOrderItem | null) => {
    const quantity = finiteNumber(item?.detail?.quantity);
    const unitPrice = nonNegativeNumber(item?.unit_price);
    const subtotal = nonNegativeNumber(item?.subtotal);
    const title = item?.title?.trim();
    return title && quantity !== null && quantity > 0 && unitPrice !== null && subtotal !== null
      ? [{ title, quantity, unitPrice, subtotal }]
      : [];
  });

  if (items.length !== order.items.length) {
    throw new Error("Placed order is missing confirmation item data");
  }

  const content = renderOrderConfirmation({
    displayId: order.display_id,
    currencyCode: order.currency_code,
    itemSubtotal,
    shippingSubtotal,
    taxTotal,
    total,
    items,
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
