import { BigNumber, ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SmtpNotificationProvider, {
  SMTP_NOTIFICATION_PROVIDER_ID,
  SmtpSender,
} from "../src/notifications/smtp.js";
import {
  ORDER_CONFIRMATION_LEGAL_SECTIONS,
  ORDER_CONFIRMATION_TEMPLATE,
  renderOrderConfirmation,
} from "../src/notifications/order-confirmation.js";
import orderPlaced, { config } from "../src/subscribers/order-placed.js";
import { notificationModule } from "../src/config/notification.js";

const smtpOptions = {
  host: "smtp.example.test",
  port: 587 as const,
  username: "smtp-user",
  password: "smtp-password",
  fromName: "Plepic Games Test",
  envelopeFrom: "orders@example.test",
};

const order = {
  id: "order_123",
  display_id: 1042,
  email: "customer@example.test",
  currency_code: "eur",
  total: 25.99,
  items: [
    { id: "item_1", title: "Moonrock & <Ore>", quantity: 2, unit_price: 1299 },
  ],
};

const legal = {
  merchantLegalName: "Lunar <Base> OÜ",
  merchantRegisteredAddress: "Moon & Crater 1, Tallinn",
  merchantContactAddress: "orders@example.test",
  returnAddress: "Return Depot, Moon > Earth",
};

function legalParagraphs(anchor: string): readonly string[] {
  const sectionIndex = ["withdrawal", "withdrawal-form", "returns-process"].indexOf(anchor);
  const section = ORDER_CONFIRMATION_LEGAL_SECTIONS[sectionIndex];
  if (section === undefined) throw new Error(`Missing email legal section: ${anchor}`);
  return section.paragraphs.map((paragraph) =>
    paragraph
      .replaceAll("{merchantLegalName}", legal.merchantLegalName)
      .replaceAll("{merchantRegisteredAddress}", legal.merchantRegisteredAddress)
      .replaceAll("{merchantContactAddress}", legal.merchantContactAddress)
      .replaceAll("{returnAddress}", legal.returnAddress),
  );
}

beforeEach(() => {
  vi.stubEnv("MERCHANT_LEGAL_NAME", legal.merchantLegalName);
  vi.stubEnv("MERCHANT_REGISTERED_ADDRESS", legal.merchantRegisteredAddress);
  vi.stubEnv("MERCHANT_CONTACT_ADDRESS", legal.merchantContactAddress);
  vi.stubEnv("MERCHANT_RETURN_ADDRESS", legal.returnAddress);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("order confirmation templates", () => {
  it("renders a deterministic escaped summary with an authoritative EUR total", () => {
    const rendered = renderOrderConfirmation(order, legal);
    const requiredParagraphs = [
      ...legalParagraphs("withdrawal"),
      ...legalParagraphs("withdrawal-form"),
      ...legalParagraphs("returns-process"),
    ];

    expect(rendered.subject).toBe("Order #1042 confirmed");
    expect(rendered.text).toBe(
      `Order #1042 confirmed\n\n2 × Moonrock & <Ore>\n\nTotal: €25.99 EUR\n\n` +
        [
          "You have 14 days to change your mind",
          ...legalParagraphs("withdrawal"),
          "Model withdrawal form",
          ...legalParagraphs("withdrawal-form"),
          "Sending it back, and getting your money",
          ...legalParagraphs("returns-process"),
        ].join("\n\n"),
    );
    expect(rendered.html).toContain(
      "<h1>Order #1042 confirmed</h1><ul><li>2 × Moonrock &amp; &lt;Ore&gt;</li></ul><p>Total: €25.99 EUR</p>",
    );
    expect(rendered.html).toContain("Lunar &lt;Base&gt; OÜ");
    expect(rendered.html).toContain("Moon &amp; Crater 1, Tallinn");
    expect(rendered.html).toContain("Return Depot, Moon &gt; Earth");
    for (const paragraph of requiredParagraphs) {
      expect(rendered.text).toContain(paragraph);
    }
    expect(rendered.html).not.toContain("{merchant");
    expect(rendered.html).not.toContain("{returnAddress}");
    expect(rendered).toMatchObject({
      subject: "Order #1042 confirmed",
    });
  });
});

describe("SMTP notification provider", () => {
  it("registers the custom provider for the email channel", () => {
    expect(notificationModule(smtpOptions)).toEqual({
      resolve: "@medusajs/medusa/notification",
      options: {
        providers: [
          {
            resolve: "./src/notifications",
            id: SMTP_NOTIFICATION_PROVIDER_ID,
            options: { ...smtpOptions, channels: ["email"] },
          },
        ],
      },
    });
  });

  it("uses strict STARTTLS transport settings and converts email DTO content into SMTP mail", async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: "smtp-message-id" });
    const transport = { sendMail };
    const sender = new SmtpSender(smtpOptions, () => transport);
    const provider = new SmtpNotificationProvider({}, smtpOptions, sender);

    await expect(provider.send({
      to: "customer@example.test",
      channel: "email",
      template: ORDER_CONFIRMATION_TEMPLATE,
      content: { subject: "Order #1042 confirmed", text: "Plain", html: "<p>HTML</p>" },
    })).resolves.toEqual({ id: "smtp-message-id" });

    expect(sender.transportOptions).toEqual({
      host: "smtp.example.test",
      port: 587,
      secure: false,
      requireTLS: true,
      auth: { user: "smtp-user", pass: "smtp-password" },
      tls: { rejectUnauthorized: true, minVersion: "TLSv1.2" },
    });
    expect(sendMail).toHaveBeenCalledWith({
      from: { name: "Plepic Games Test", address: "orders@example.test" },
      envelope: { from: "orders@example.test", to: "customer@example.test" },
      to: "customer@example.test",
      subject: "Order #1042 confirmed",
      text: "Plain",
      html: "<p>HTML</p>",
    });
  });

  it("redacts SMTP failures and does not log notification payloads or credentials", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const sender = new SmtpSender(smtpOptions, () => ({
      sendMail: vi.fn().mockRejectedValue(new Error("smtp-password recipient@example.test")),
    }));

    await expect(sender.send({
      to: "recipient@example.test",
      subject: "Subject",
      text: "Secret content",
      html: "<p>Secret content</p>",
    })).rejects.toThrow("Unable to send email notification");
    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleLog).not.toHaveBeenCalled();
  });
});

describe("order.placed subscriber", () => {
  it("queries the order fields needed for confirmation and persists one idempotent email", async () => {
    const graph = vi.fn().mockResolvedValue({
      data: [{
        ...order,
        items: order.items.map(({ quantity, ...item }) => ({
          ...item,
          detail: { quantity },
        })),
      }],
    });
    const createNotifications = vi.fn().mockResolvedValue({ id: "noti_123" });
    const container = {
      resolve: vi.fn((key: string) => {
        if (key === ContainerRegistrationKeys.QUERY) return { graph };
        if (key === Modules.NOTIFICATION) return { createNotifications };
        throw new Error(`Unexpected registration: ${key}`);
      }),
    };

    await orderPlaced({
      event: { name: "order.placed", data: { id: order.id } },
      container,
      pluginOptions: {},
    } as never);

    expect(config).toEqual({ event: "order.placed" });
    expect(graph).toHaveBeenCalledWith({
      entity: "order",
      fields: ["id", "display_id", "email", "currency_code", "total", "items.id", "items.title", "items.detail.quantity"],
      filters: { id: "order_123" },
    });
    expect(createNotifications).toHaveBeenCalledTimes(1);
    expect(createNotifications).toHaveBeenCalledWith({
      to: "customer@example.test",
      channel: "email",
      template: ORDER_CONFIRMATION_TEMPLATE,
      content: renderOrderConfirmation(order, legal),
      trigger_type: "order.placed",
      resource_id: "order_123",
      resource_type: "order",
      idempotency_key: "order-confirmation:order_123",
    });
  });

  it("renders Medusa Query Graph numbers and the order item detail quantity", async () => {
    const queriedOrder = {
      ...order,
      total: new BigNumber("25.99"),
      items: [{
        id: "item_1",
        title: "Moonrock & <Ore>",
        unit_price: new BigNumber("12.995"),
        detail: { quantity: new BigNumber(2) },
      }],
    };
    const graph = vi.fn().mockResolvedValue({ data: [queriedOrder] });
    const createNotifications = vi.fn().mockResolvedValue({ id: "noti_123" });
    const container = {
      resolve: vi.fn((key: string) => {
        if (key === ContainerRegistrationKeys.QUERY) return { graph };
        if (key === Modules.NOTIFICATION) return { createNotifications };
        throw new Error(`Unexpected registration: ${key}`);
      }),
    };

    await orderPlaced({
      event: { name: "order.placed", data: { id: order.id } },
      container,
      pluginOptions: {},
    } as never);

    expect(graph).toHaveBeenCalledWith({
      entity: "order",
      fields: ["id", "display_id", "email", "currency_code", "total", "items.id", "items.title", "items.detail.quantity"],
      filters: { id: "order_123" },
    });
    expect(createNotifications).toHaveBeenCalledWith(expect.objectContaining({
      content: renderOrderConfirmation(order, legal),
    }));
  });

  it.each([
    ["null total", {
      ...order,
      total: null,
      items: [{ ...order.items[0], detail: { quantity: order.items[0].quantity } }],
    }],
    ["null item quantity", {
      ...order,
      items: [{ ...order.items[0], detail: { quantity: null } }],
    }],
    ["non-finite total", {
      ...order,
      total: new BigNumber("Infinity"),
      items: [{ ...order.items[0], detail: { quantity: order.items[0].quantity } }],
    }],
    ["non-finite item quantity", {
      ...order,
      items: [{ ...order.items[0], detail: { quantity: new BigNumber("NaN") } }],
    }],
  ])("rejects a Query Graph %s", async (_field, queriedOrder) => {
    const graph = vi.fn().mockResolvedValue({ data: [queriedOrder] });
    const createNotifications = vi.fn();
    const container = {
      resolve: vi.fn((key: string) => {
        if (key === ContainerRegistrationKeys.QUERY) return { graph };
        if (key === Modules.NOTIFICATION) return { createNotifications };
        throw new Error(`Unexpected registration: ${key}`);
      }),
    };

    await expect(orderPlaced({
      event: { name: "order.placed", data: { id: order.id } },
      container,
      pluginOptions: {},
    } as never)).rejects.toThrow("Placed order is missing confirmation");
    expect(createNotifications).not.toHaveBeenCalled();
  });

  it("uses the documented provider id", () => {
    expect(SMTP_NOTIFICATION_PROVIDER_ID).toBe("plepic-smtp");
    expect(SmtpNotificationProvider.identifier).toBe("plepic-smtp");
  });
});
