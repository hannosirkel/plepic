import type { SubscriberArgs } from "@medusajs/framework";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

import {
  DELIVERY_NOTIFICATION_TEMPLATE,
  renderDeliveryNotification,
  renderShipmentNotification,
  SHIPMENT_NOTIFICATION_TEMPLATE,
} from "../notifications/fulfillment-status.js";

export interface FulfillmentEvent {
  readonly id: string;
  readonly no_notification?: boolean;
}

interface QueriedFulfillment {
  readonly id?: unknown;
  readonly order?: {
    readonly id?: unknown;
    readonly display_id?: unknown;
    readonly email?: unknown;
  } | null;
  readonly labels?: readonly {
    readonly tracking_number?: unknown;
    readonly tracking_url?: unknown;
  }[] | null;
}

function nonBlankString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function displayId(value: unknown): number | string | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  return nonBlankString(value);
}

export async function sendFulfillmentStatusNotification(
  { event, container }: SubscriberArgs<FulfillmentEvent>,
  kind: "shipment" | "delivery",
): Promise<void> {
  if (event.data.no_notification === true) return;

  const eventId = nonBlankString(event.data.id);
  if (!eventId) {
    throw new Error("Fulfillment event is missing an ID");
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const fields = ["id", "order.id", "order.display_id", "order.email"];
  if (kind === "shipment") {
    fields.push("labels.tracking_number", "labels.tracking_url");
  }
  const { data } = await query.graph({
    entity: "fulfillment",
    fields,
    filters: { id: eventId },
  });
  const fulfillment = data[0] as QueriedFulfillment | undefined;
  const fulfillmentId = nonBlankString(fulfillment?.id);
  const orderId = nonBlankString(fulfillment?.order?.id);
  const email = nonBlankString(fulfillment?.order?.email);
  const orderDisplayId = displayId(fulfillment?.order?.display_id);

  if (!fulfillment || !fulfillmentId || !orderId || !email || orderDisplayId === null) {
    throw new Error("Fulfillment notification data is unavailable");
  }

  const tracking = Array.isArray(fulfillment.labels)
    ? fulfillment.labels.map((label) => ({
      number: typeof label.tracking_number === "string"
        ? label.tracking_number
        : undefined,
      url: typeof label.tracking_url === "string" ? label.tracking_url : undefined,
    }))
    : [];
  const content = kind === "shipment"
    ? renderShipmentNotification({ displayId: orderDisplayId, tracking })
    : renderDeliveryNotification({ displayId: orderDisplayId });
  const template = kind === "shipment"
    ? SHIPMENT_NOTIFICATION_TEMPLATE
    : DELIVERY_NOTIFICATION_TEMPLATE;
  const triggerType = kind === "shipment" ? "shipment.created" : "delivery.created";
  const notification = container.resolve(Modules.NOTIFICATION);

  await notification.createNotifications({
    to: email,
    channel: "email",
    template,
    content,
    trigger_type: triggerType,
    resource_id: fulfillmentId,
    resource_type: "fulfillment",
    idempotency_key: `${template}:${fulfillmentId}`,
  });
}
