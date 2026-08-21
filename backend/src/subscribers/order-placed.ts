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
import { readOrderConfirmationLegalConfig } from "../config/runtime.js";

interface OrderPlacedEvent {
  readonly id: string;
}

interface QueriedOrderItem {
  readonly title?: string | null;
  readonly detail?: { readonly quantity?: unknown } | null;
}

function finiteNumber(value: unknown): number | null {
  if (typeof value !== "number" && (typeof value !== "object" || value === null)) {
    return null;
  }

  const converted = tryConvertToNumber(value);
  return typeof converted === "number" && Number.isFinite(converted) ? converted : null;
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
      "total",
      "items.id",
      "items.title",
      "items.detail.quantity",
    ],
    filters: { id: event.data.id },
  });
  const order = data[0];
  const total = finiteNumber(order?.total);

  if (
    !order?.email ||
    order.display_id == null ||
    !order.currency_code ||
    total === null ||
    !Array.isArray(order.items)
  ) {
    throw new Error("Placed order is missing confirmation data");
  }

  const items = order.items.flatMap((item: QueriedOrderItem | null) => {
    const quantity = finiteNumber(item?.detail?.quantity);
    return item?.title && quantity !== null ? [{ title: item.title, quantity }] : [];
  });

  if (items.length !== order.items.length) {
    throw new Error("Placed order is missing confirmation item data");
  }

  const content = renderOrderConfirmation({
    display_id: order.display_id,
    currency_code: order.currency_code,
    total,
    items,
  }, readOrderConfirmationLegalConfig(process.env));

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
