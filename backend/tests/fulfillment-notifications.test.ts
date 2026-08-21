import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { describe, expect, it, vi } from "vitest";

import deliveryCreated, {
  config as deliveryConfig,
} from "../src/subscribers/delivery-created.js";
import shipmentCreated, {
  config as shipmentConfig,
} from "../src/subscribers/shipment-created.js";
import {
  DELIVERY_NOTIFICATION_TEMPLATE,
  renderDeliveryNotification,
  renderShipmentNotification,
  SHIPMENT_NOTIFICATION_TEMPLATE,
} from "../src/notifications/fulfillment-status.js";

const queriedFulfillment = {
  id: "ful_123",
  order: {
    id: "order_123",
    display_id: 1042,
    email: "customer@example.test",
  },
  labels: [
    {
      tracking_number: " TRACK-ONE ",
      tracking_url: " https://carrier.example.test/track/one ",
    },
    {
      tracking_number: "TRACK-TWO",
      tracking_url: "http://carrier.example.test/track/two",
    },
  ],
};

function subscriberArgs(
  data: unknown[],
  eventData: { id: string; no_notification?: boolean } = { id: "ful_123" },
) {
  const graph = vi.fn().mockResolvedValue({ data });
  const createNotifications = vi.fn().mockResolvedValue({ id: "noti_123" });
  const container = {
    resolve: vi.fn((key: string) => {
      if (key === ContainerRegistrationKeys.QUERY) return { graph };
      if (key === Modules.NOTIFICATION) return { createNotifications };
      throw new Error(`Unexpected registration: ${key}`);
    }),
  };

  return {
    args: {
      event: { name: "fulfillment.event", data: eventData },
      container,
      pluginOptions: {},
    } as never,
    container,
    graph,
    createNotifications,
  };
}

describe("fulfillment status templates", () => {
  it("renders shipment status with multiple numbers and only HTTP(S) tracking links", () => {
    const rendered = renderShipmentNotification({
      displayId: 1042,
      tracking: [
        {
          number: " TRACK-ONE ",
          url: " https://carrier.example.test/track/one?lang=en&mode=full ",
        },
        { number: "TRACK-TWO", url: "http://carrier.example.test/track/two" },
        { number: "TRACK-THREE", url: "javascript:alert(1)" },
        { number: "TRACK-FOUR", url: "not a URL" },
      ],
    });

    expect(rendered.subject).toBe("Order #1042 has shipped");
    expect(rendered.text).toContain("Status\tShipped");
    expect(rendered.text).toContain("Order\t#1042");
    expect(rendered.text).toContain("TRACK-ONE");
    expect(rendered.text).toContain("TRACK-TWO");
    expect(rendered.text).toContain("TRACK-THREE");
    expect(rendered.text).toContain("TRACK-FOUR");
    expect(rendered.html).toContain(
      'href="https://carrier.example.test/track/one?lang=en&amp;mode=full"',
    );
    expect(rendered.html).toContain(
      'href="http://carrier.example.test/track/two"',
    );
    expect(rendered.html).not.toContain("javascript:");
    expect(rendered.html).not.toContain("not a URL");
    expect(rendered.text).not.toContain("javascript:");
    expect(rendered.text).not.toContain("not a URL");
  });

  it("escapes tracking numbers and link text", () => {
    const rendered = renderShipmentNotification({
      displayId: 1042,
      tracking: [{
        number: "TRACK-<ONE>",
        url: 'https://carrier.example.test/track?value="one"&other=<two>',
      }],
    });

    expect(rendered.html).toContain("TRACK-&lt;ONE&gt;");
    expect(rendered.html).not.toContain("TRACK-<ONE>");
    expect(rendered.html).toContain("&quot;one&quot;&amp;other=&lt;two&gt;");
    expect(rendered.html).not.toContain('href="https://carrier.example.test/track?value="one"');
  });

  it("omits the complete tracking section when no usable tracking data exists", () => {
    const rendered = renderShipmentNotification({
      displayId: 1042,
      tracking: [{ number: "  ", url: "javascript:alert(1)" }],
    });

    expect(rendered.text).not.toContain("Tracking");
    expect(rendered.html).not.toContain("Tracking");
  });

  it("renders only the delivery status in the shared shell", () => {
    const rendered = renderDeliveryNotification({ displayId: 1042 });

    expect(rendered.subject).toBe("Order #1042 delivered");
    expect(rendered.text).toContain("Status\tDelivered");
    expect(rendered.text).toContain("Order\t#1042");
    expect(rendered.text).not.toContain("Shipped");
    expect(rendered.text).not.toContain("Tracking");
    expect(rendered.html).not.toContain("Shipped");
    expect(rendered.html).not.toContain("Tracking");
  });
});

describe("fulfillment lifecycle subscribers", () => {
  it("registers the shipment and delivery event entry points", () => {
    expect(shipmentConfig).toEqual({ event: "shipment.created" });
    expect(deliveryConfig).toEqual({ event: "delivery.created" });
  });

  it.each([
    ["shipment", shipmentCreated],
    ["delivery", deliveryCreated],
  ])("returns before container access when a %s notification is disabled", async (_kind, subscriber) => {
    const { args, container } = subscriberArgs([], {
      id: "ful_123",
      no_notification: true,
    });

    await subscriber(args);

    expect(container.resolve).not.toHaveBeenCalled();
  });

  it("queries shipment data and persists one idempotent shipment email", async () => {
    const { args, graph, createNotifications } = subscriberArgs([queriedFulfillment]);

    await shipmentCreated(args);

    expect(graph).toHaveBeenCalledWith({
      entity: "fulfillment",
      fields: [
        "id",
        "order.id",
        "order.display_id",
        "order.email",
        "labels.tracking_number",
        "labels.tracking_url",
      ],
      filters: { id: "ful_123" },
    });
    expect(createNotifications).toHaveBeenCalledTimes(1);
    expect(createNotifications).toHaveBeenCalledWith({
      to: "customer@example.test",
      channel: "email",
      template: SHIPMENT_NOTIFICATION_TEMPLATE,
      content: renderShipmentNotification({
        displayId: 1042,
        tracking: [
          {
            number: " TRACK-ONE ",
            url: " https://carrier.example.test/track/one ",
          },
          {
            number: "TRACK-TWO",
            url: "http://carrier.example.test/track/two",
          },
        ],
      }),
      trigger_type: "shipment.created",
      resource_id: "ful_123",
      resource_type: "fulfillment",
      idempotency_key: "shipment-notification:ful_123",
    });
  });

  it("queries delivery data and persists one idempotent delivery email", async () => {
    const { args, graph, createNotifications } = subscriberArgs([queriedFulfillment]);

    await deliveryCreated(args);

    expect(graph).toHaveBeenCalledWith({
      entity: "fulfillment",
      fields: ["id", "order.id", "order.display_id", "order.email"],
      filters: { id: "ful_123" },
    });
    expect(createNotifications).toHaveBeenCalledTimes(1);
    expect(createNotifications).toHaveBeenCalledWith({
      to: "customer@example.test",
      channel: "email",
      template: DELIVERY_NOTIFICATION_TEMPLATE,
      content: renderDeliveryNotification({ displayId: 1042 }),
      trigger_type: "delivery.created",
      resource_id: "ful_123",
      resource_type: "fulfillment",
      idempotency_key: "delivery-notification:ful_123",
    });
  });

  it.each([
    ["blank event ID", "shipment", shipmentCreated, { id: "  " }, [queriedFulfillment]],
    ["blank event ID", "delivery", deliveryCreated, { id: "  " }, [queriedFulfillment]],
    ["no graph result", "shipment", shipmentCreated, { id: "ful_123" }, []],
    ["no graph result", "delivery", deliveryCreated, { id: "ful_123" }, []],
    ["absent linked order", "shipment", shipmentCreated, { id: "ful_123" }, [{ ...queriedFulfillment, order: null }]],
    ["absent linked order", "delivery", deliveryCreated, { id: "ful_123" }, [{ ...queriedFulfillment, order: null }]],
    ["blank email", "shipment", shipmentCreated, { id: "ful_123" }, [{ ...queriedFulfillment, order: { ...queriedFulfillment.order, email: "  " } }]],
    ["blank email", "delivery", deliveryCreated, { id: "ful_123" }, [{ ...queriedFulfillment, order: { ...queriedFulfillment.order, email: "  " } }]],
    ["absent display ID", "shipment", shipmentCreated, { id: "ful_123" }, [{ ...queriedFulfillment, order: { ...queriedFulfillment.order, display_id: null } }]],
    ["absent display ID", "delivery", deliveryCreated, { id: "ful_123" }, [{ ...queriedFulfillment, order: { ...queriedFulfillment.order, display_id: null } }]],
  ])("refuses %s data for %s notifications", async (
    refusal,
    _kind,
    subscriber,
    eventData,
    graphData,
  ) => {
    const { args, createNotifications } = subscriberArgs(graphData, eventData);

    await expect(subscriber(args)).rejects.toThrow(
      refusal === "blank event ID"
        ? "Fulfillment event is missing an ID"
        : "Fulfillment notification data is unavailable",
    );
    expect(createNotifications).not.toHaveBeenCalled();
  });
});
