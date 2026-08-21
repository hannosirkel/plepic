import {
  escapeHtml,
  formatMoney,
  renderTransactionalEmail,
  type EmailContent,
} from "./transactional-email.js";

export const ORDER_CONFIRMATION_TEMPLATE = "order-confirmation";

export interface OrderConfirmationOrder {
  readonly displayId: number | string;
  readonly currencyCode: string;
  readonly itemSubtotal: number;
  readonly shippingSubtotal: number;
  readonly taxTotal: number;
  readonly total: number;
  readonly items: readonly {
    readonly title: string;
    readonly quantity: number;
    readonly unitPrice: number;
    readonly subtotal: number;
  }[];
  readonly shippingAddress: readonly string[];
}

function requireMoney(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Order confirmation requires a non-negative finite ${field}`);
  }
}

function validateOrder(order: OrderConfirmationOrder): void {
  if (String(order.displayId).trim().length === 0) {
    throw new Error("Order confirmation requires an order number");
  }
  if (order.currencyCode.trim().length === 0) {
    throw new Error("Order confirmation requires a currency code");
  }

  requireMoney(order.itemSubtotal, "item subtotal");
  requireMoney(order.shippingSubtotal, "shipping subtotal");
  requireMoney(order.taxTotal, "tax total");
  requireMoney(order.total, "total");

  if (order.items.length === 0) {
    throw new Error("Order confirmation requires at least one item");
  }
  for (const item of order.items) {
    if (item.title.trim().length === 0) {
      throw new Error("Order confirmation requires non-blank item titles");
    }
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      throw new Error("Order confirmation requires positive finite item quantities");
    }
    requireMoney(item.unitPrice, "item unit price");
    requireMoney(item.subtotal, "item subtotal");
  }

  if (
    order.shippingAddress.length === 0 ||
    order.shippingAddress.some((line) => line.trim().length === 0)
  ) {
    throw new Error("Order confirmation requires a non-empty shipping address");
  }
}

function amountCell(value: string): string {
  return `<td align="right" style="padding:10px 0 10px 12px;border-bottom:1px solid #d9d4c6;font-size:14px;line-height:20px;white-space:nowrap;">${escapeHtml(value)}</td>`;
}

export function renderOrderConfirmation(order: OrderConfirmationOrder): EmailContent {
  validateOrder(order);

  const displayId = String(order.displayId);
  const orderNumber = `#${displayId}`;
  const subject = `Order ${orderNumber} confirmed`;
  const itemRows = order.items.map((item) => {
    const unitPrice = formatMoney(item.unitPrice, order.currencyCode);
    const subtotal = formatMoney(item.subtotal, order.currencyCode);
    return `<tr>
  <td style="padding:10px 12px 10px 0;border-bottom:1px solid #d9d4c6;font-size:14px;line-height:20px;">${escapeHtml(item.title)}</td>
  <td align="right" style="padding:10px 0 10px 12px;border-bottom:1px solid #d9d4c6;font-size:14px;line-height:20px;">${escapeHtml(String(item.quantity))}</td>
  ${amountCell(unitPrice)}
  ${amountCell(subtotal)}
</tr>`;
  }).join("");
  const itemText = order.items.map((item) => [
    item.title,
    String(item.quantity),
    formatMoney(item.unitPrice, order.currencyCode),
    formatMoney(item.subtotal, order.currencyCode),
  ].join("\t")).join("\n");
  const products = formatMoney(order.itemSubtotal, order.currencyCode);
  const shipping = formatMoney(order.shippingSubtotal, order.currencyCode);
  const tax = formatMoney(order.taxTotal, order.currencyCode);
  const total = formatMoney(order.total, order.currencyCode);
  const vatHtml = order.taxTotal === 0 ? "" : `<tr>
  <td style="padding:7px 12px 7px 0;font-size:14px;line-height:20px;">VAT</td>
  <td align="right" style="padding:7px 0;font-size:14px;line-height:20px;">${escapeHtml(tax)}</td>
</tr>`;
  const vatText = order.taxTotal === 0 ? "" : `\nVAT\t${tax}`;
  const addressHtml = order.shippingAddress.map(escapeHtml).join("<br>");
  const addressText = order.shippingAddress.join("\n");
  const bodyHtml = `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;">
  <tr>
    <th align="left" style="padding:10px 12px 10px 0;border-bottom:2px solid #151b46;font-size:12px;line-height:18px;text-transform:uppercase;">Product</th>
    <th align="right" style="padding:10px 0 10px 12px;border-bottom:2px solid #151b46;font-size:12px;line-height:18px;text-transform:uppercase;">Qty</th>
    <th align="right" style="padding:10px 0 10px 12px;border-bottom:2px solid #151b46;font-size:12px;line-height:18px;text-transform:uppercase;">Unit price</th>
    <th align="right" style="padding:10px 0 10px 12px;border-bottom:2px solid #151b46;font-size:12px;line-height:18px;text-transform:uppercase;">Amount</th>
  </tr>
  ${itemRows}
</table>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin-top:16px;border-collapse:collapse;">
  <tr>
    <td style="padding:7px 12px 7px 0;font-size:14px;line-height:20px;">Products</td>
    <td align="right" style="padding:7px 0;font-size:14px;line-height:20px;">${escapeHtml(products)}</td>
  </tr>
  <tr>
    <td style="padding:7px 12px 7px 0;font-size:14px;line-height:20px;">Shipping</td>
    <td align="right" style="padding:7px 0;font-size:14px;line-height:20px;">${escapeHtml(shipping)}</td>
  </tr>
  ${vatHtml}
  <tr>
    <td style="padding:12px 12px 0 0;border-top:2px solid #151b46;font-size:16px;line-height:22px;font-weight:700;">Total</td>
    <td align="right" style="padding:12px 0 0;border-top:2px solid #151b46;font-size:16px;line-height:22px;font-weight:700;">${escapeHtml(total)}</td>
  </tr>
</table>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin-top:28px;border-collapse:collapse;">
  <tr>
    <td style="padding:16px;background:#f7f4ec;border:1px solid #d9d4c6;font-size:14px;line-height:22px;">
      <strong style="display:block;margin-bottom:6px;">Shipping address</strong>
      ${addressHtml}
    </td>
  </tr>
</table>`;
  const bodyText = `Product\tQty\tUnit price\tAmount
${itemText}

Products\t${products}
Shipping\t${shipping}${vatText}
Total\t${total}

Shipping address
${addressText}`;

  return renderTransactionalEmail({
    subject,
    preheader: `${subject}.`,
    status: "Confirmed",
    orderNumber,
    bodyHtml,
    bodyText,
  });
}
