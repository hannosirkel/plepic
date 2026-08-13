import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

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
  readonly quantity?: number | null;
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
      "items.quantity",
      "items.unit_price",
    ],
    filters: { id: event.data.id },
  });
  const order = data[0];

  if (
    !order?.email ||
    order.display_id == null ||
    !order.currency_code ||
    typeof order.total !== "number" ||
    !Array.isArray(order.items)
  ) {
    throw new Error("Placed order is missing confirmation data");
  }

  const items = order.items.flatMap((item: QueriedOrderItem | null) =>
    item?.title && typeof item.quantity === "number"
      ? [{ title: item.title, quantity: item.quantity }]
      : [],
  );

  if (items.length !== order.items.length) {
    throw new Error("Placed order is missing confirmation item data");
  }

  const content = renderOrderConfirmation({
    display_id: order.display_id,
    currency_code: order.currency_code,
    total: order.total,
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
