import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";

import {
  sendFulfillmentStatusNotification,
  type FulfillmentEvent,
} from "../fulfillment/send-status-notification.js";

export default async function shipmentCreated(args: SubscriberArgs<FulfillmentEvent>) {
  await sendFulfillmentStatusNotification(args, "shipment");
}

export const config: SubscriberConfig = { event: "shipment.created" };
