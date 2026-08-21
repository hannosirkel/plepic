import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";

import {
  sendFulfillmentStatusNotification,
  type FulfillmentEvent,
} from "../fulfillment/send-status-notification.js";

export default async function deliveryCreated(args: SubscriberArgs<FulfillmentEvent>) {
  await sendFulfillmentStatusNotification(args, "delivery");
}

export const config: SubscriberConfig = { event: "delivery.created" };
