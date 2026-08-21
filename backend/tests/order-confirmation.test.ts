import { BigNumber, ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import SmtpNotificationProvider, {
  SMTP_NOTIFICATION_PROVIDER_ID,
  SmtpSender,
} from "../src/notifications/smtp.js";
import {
  ORDER_CONFIRMATION_TEMPLATE,
  renderOrderConfirmation,
} from "../src/notifications/order-confirmation.js";
import {
  formatMoney,
  renderTransactionalEmail,
} from "../src/notifications/transactional-email.js";
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
  email: "customer@example.test",
};

const invoiceOrder = {
  displayId: 1042,
  currencyCode: "eur",
  itemSubtotal: 20,
  shippingSubtotal: 5,
  taxTotal: 5.5,
  total: 30.5,
  items: [
    { title: "Moonrock & <Ore>", quantity: 2, unitPrice: 10, subtotal: 20 },
    { title: "Mission patch", quantity: 1, unitPrice: 0, subtotal: 0 },
  ],
  shippingAddress: [
    "Ada Lovelace",
    "Plepic Games OÜ",
    "Pihlaka tn 2",
    "75301 Jüri",
    "EE",
  ],
};

const queriedOrder = {
  id: order.id,
  display_id: invoiceOrder.displayId,
  email: order.email,
  currency_code: invoiceOrder.currencyCode,
  item_subtotal: new BigNumber(invoiceOrder.itemSubtotal),
  shipping_subtotal: new BigNumber(invoiceOrder.shippingSubtotal),
  tax_total: new BigNumber(invoiceOrder.taxTotal),
  total: new BigNumber(invoiceOrder.total),
  items: [
    {
      id: "item_1",
      title: invoiceOrder.items[0].title,
      unit_price: new BigNumber(invoiceOrder.items[0].unitPrice),
      subtotal: new BigNumber(invoiceOrder.items[0].subtotal),
      detail: { quantity: new BigNumber(invoiceOrder.items[0].quantity) },
    },
    {
      id: "item_2",
      title: invoiceOrder.items[1].title,
      unit_price: new BigNumber(invoiceOrder.items[1].unitPrice),
      subtotal: new BigNumber(invoiceOrder.items[1].subtotal),
      detail: { quantity: new BigNumber(invoiceOrder.items[1].quantity) },
    },
  ],
  shipping_address: {
    first_name: " Ada ",
    last_name: " Lovelace ",
    company: "Plepic Games OÜ",
    address_1: "Pihlaka tn 2",
    address_2: "Suite 4",
    postal_code: "75301",
    city: "Jüri",
    province: "Harjumaa",
    country_code: "ee",
  },
};

const normalizedQueriedOrder = {
  ...invoiceOrder,
  shippingAddress: [
    "Ada Lovelace",
    "Plepic Games OÜ",
    "Pihlaka tn 2",
    "Suite 4",
    "75301 Jüri",
    "Harjumaa",
    "EE",
  ],
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("shared transactional email shell", () => {
  it("formats upper-case currency and rejects non-finite money", () => {
    expect(formatMoney(10, "eur")).toBe("€10.00 EUR");
    expect(() => formatMoney(Number.NaN, "eur")).toThrow("finite");
    expect(() => formatMoney(Number.POSITIVE_INFINITY, "eur")).toThrow("finite");
  });

  it("escapes shell-owned headings while preserving typed renderer markup", () => {
    const rendered = renderTransactionalEmail({
      subject: "Order <unsafe>",
      preheader: "Preheader & <unsafe>",
      status: "<Confirmed>",
      orderNumber: "#<1042>",
      bodyHtml: "<table><tr><td>Typed renderer markup</td></tr></table>",
      bodyText: "Typed renderer text",
    });

    expect(rendered.subject).toBe("Order <unsafe>");
    expect(rendered.html).toContain("Order &lt;unsafe&gt;");
    expect(rendered.html).toContain("Preheader &amp; &lt;unsafe&gt;");
    expect(rendered.html).toContain("&lt;Confirmed&gt;");
    expect(rendered.html).toContain("#&lt;1042&gt;");
    expect(rendered.html).toContain(
      "<table><tr><td>Typed renderer markup</td></tr></table>",
    );
  });
});

describe("order confirmation templates", () => {
  it("uses only the approved publisher palette", () => {
    const rendered = renderOrderConfirmation(invoiceOrder);
    const approvedColors = new Set(["#151b46", "#f7f4ec", "#ffffff", "#d9d4c6"]);
    const renderedColors = [...rendered.html.matchAll(/style="([^"]*)"/g)].flatMap(
      ([, style]) => style?.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [],
    );
    const unapprovedColors = [
      ...new Set(renderedColors.map((color) => color.toLowerCase())),
    ].filter((color) => !approvedColors.has(color));

    expect(unapprovedColors).toEqual([]);
  });

  it("renders an escaped invoice from authoritative order totals", () => {
    const rendered = renderOrderConfirmation(invoiceOrder);

    expect(rendered.subject).toBe("Order #1042 confirmed");
    expect(rendered.text).toContain("Product\tQty\tUnit price\tAmount");
    expect(rendered.text).toContain("Moonrock & <Ore>\t2\t€10.00 EUR\t€20.00 EUR");
    expect(rendered.text).toContain("Products\t€20.00 EUR");
    expect(rendered.text).toContain("Shipping\t€5.00 EUR");
    expect(rendered.text).toContain("VAT\t€5.50 EUR");
    expect(rendered.text).toContain("Total\t€30.50 EUR");
    expect(rendered.text).toContain(
      "Ada Lovelace\nPlepic Games OÜ\nPihlaka tn 2\n75301 Jüri\nEE",
    );
    expect(rendered.text).not.toContain("withdraw");
    expect(rendered.html).toContain("Order #1042");
    expect(rendered.html).toContain("Moonrock &amp; &lt;Ore&gt;");
  });

  it("omits the VAT row when the authoritative tax total is zero", () => {
    const rendered = renderOrderConfirmation({
      ...invoiceOrder,
      taxTotal: 0,
      total: 25,
    });

    expect(rendered.text).not.toContain("\nVAT\t");
    expect(rendered.html).not.toContain(">VAT<");
  });

  it("escapes hostile dynamic values without creating HTML tags", () => {
    const rendered = renderOrderConfirmation({
      ...invoiceOrder,
      displayId: "</td><script>alert(1)</script>",
      items: [{
        title: "</td><img src=x onerror=alert(1)>",
        quantity: 1,
        unitPrice: 20,
        subtotal: 20,
      }],
      shippingAddress: ["<script>alert(2)</script>", "Crater & <Base>"],
    });

    expect(rendered.html).toContain("&lt;/td&gt;&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(rendered.html).toContain("&lt;/td&gt;&lt;img src=x onerror=alert(1)&gt;");
    expect(rendered.html).toContain("&lt;script&gt;alert(2)&lt;/script&gt;");
    expect(rendered.html).toContain("Crater &amp; &lt;Base&gt;");
    expect(rendered.html).not.toContain("<script>");
    expect(rendered.html).not.toContain("<img src=x");
  });

  it.each([
    ["negative item subtotal", { itemSubtotal: -1 }],
    ["non-finite shipping subtotal", { shippingSubtotal: Number.POSITIVE_INFINITY }],
    ["negative tax total", { taxTotal: -1 }],
    ["non-finite total", { total: Number.NaN }],
    ["empty items", { items: [] }],
    ["empty address", { shippingAddress: [] }],
    ["blank title", { items: [{ ...invoiceOrder.items[0], title: "  " }] }],
    ["non-positive quantity", { items: [{ ...invoiceOrder.items[0], quantity: 0 }] }],
    ["negative unit price", { items: [{ ...invoiceOrder.items[0], unitPrice: -1 }] }],
    ["non-finite line subtotal", {
      items: [{ ...invoiceOrder.items[0], subtotal: Number.NEGATIVE_INFINITY }],
    }],
  ])("rejects an order with a %s", (_case, override) => {
    expect(() => renderOrderConfirmation({ ...invoiceOrder, ...override })).toThrow(
      "Order confirmation requires",
    );
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

    expect(config).toEqual({ event: "order.placed" });
    expect(graph).toHaveBeenCalledWith({
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
      filters: { id: "order_123" },
    });
    expect(createNotifications).toHaveBeenCalledTimes(1);
    expect(createNotifications).toHaveBeenCalledWith({
      to: "customer@example.test",
      channel: "email",
      template: ORDER_CONFIRMATION_TEMPLATE,
      content: renderOrderConfirmation(normalizedQueriedOrder),
      trigger_type: "order.placed",
      resource_id: "order_123",
      resource_type: "order",
      idempotency_key: "order-confirmation:order_123",
    });
  });

  it("omits blank optional address fields without emitting blank lines", async () => {
    const partialAddressOrder = {
      ...queriedOrder,
      shipping_address: {
        first_name: "Ada",
        last_name: " ",
        company: null,
        address_1: "Pihlaka tn 2",
        address_2: "",
        postal_code: "75301",
        city: "Jüri",
        province: undefined,
        country_code: "ee",
      },
    };
    const graph = vi.fn().mockResolvedValue({ data: [partialAddressOrder] });
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

    expect(createNotifications).toHaveBeenCalledWith(expect.objectContaining({
      content: renderOrderConfirmation({
        ...invoiceOrder,
        shippingAddress: ["Ada", "Pihlaka tn 2", "75301 Jüri", "EE"],
      }),
    }));
  });

  it.each([
    ["null total", {
      ...queriedOrder,
      total: null,
    }],
    ["non-finite total", {
      ...queriedOrder,
      total: new BigNumber("Infinity"),
    }],
    ["null products subtotal", {
      ...queriedOrder,
      item_subtotal: null,
    }],
    ["null item subtotal", {
      ...queriedOrder,
      items: [{ ...queriedOrder.items[0], subtotal: null }, queriedOrder.items[1]],
    }],
    ["null item unit price", {
      ...queriedOrder,
      items: [{ ...queriedOrder.items[0], unit_price: null }, queriedOrder.items[1]],
    }],
    ["null item quantity", {
      ...queriedOrder,
      items: [
        { ...queriedOrder.items[0], detail: { quantity: null } },
        queriedOrder.items[1],
      ],
    }],
    ["empty items", {
      ...queriedOrder,
      items: [],
    }],
    ["absent shipping address", {
      ...queriedOrder,
      shipping_address: null,
    }],
    ["address with no printable line", {
      ...queriedOrder,
      shipping_address: {
        first_name: " ",
        last_name: null,
        company: "",
        address_1: undefined,
        address_2: "\t",
        postal_code: "",
        city: " ",
        province: null,
        country_code: "",
      },
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
