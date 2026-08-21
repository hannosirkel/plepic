import {
  escapeHtml,
  renderTransactionalEmail,
  type EmailContent,
} from "./transactional-email.js";

export const SHIPMENT_NOTIFICATION_TEMPLATE = "shipment-notification";
export const DELIVERY_NOTIFICATION_TEMPLATE = "delivery-notification";

interface TrackingDetails {
  readonly number?: string;
  readonly url?: string;
}

function httpUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? trimmed : null;
  } catch {
    return null;
  }
}

export function renderShipmentNotification(input: {
  readonly displayId: number | string;
  readonly tracking: readonly TrackingDetails[];
}): EmailContent {
  const orderNumber = `#${String(input.displayId)}`;
  const subject = `Order ${orderNumber} has shipped`;
  const tracking = input.tracking.flatMap((item) => {
    const number = item.number?.trim() || null;
    const url = httpUrl(item.url);
    return number || url ? [{ number, url }] : [];
  });
  const bodyHtml = tracking.length === 0 ? "" : `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;table-layout:fixed;">
  <tr>
    <th colspan="2" align="left" style="padding:10px 0;border-bottom:2px solid #151b46;font-size:12px;line-height:18px;text-transform:uppercase;">Tracking</th>
  </tr>
  ${tracking.map(({ number, url }) => [
    number ? `<tr>
    <td style="padding:10px 12px 10px 0;border-bottom:1px solid #d9d4c6;font-size:14px;line-height:20px;">Tracking number</td>
    <td style="padding:10px 0;border-bottom:1px solid #d9d4c6;font-size:14px;line-height:20px;overflow-wrap:anywhere;word-break:break-word;">${escapeHtml(number)}</td>
  </tr>` : "",
    url ? `<tr>
    <td style="padding:10px 12px 10px 0;border-bottom:1px solid #d9d4c6;font-size:14px;line-height:20px;">Tracking link</td>
    <td style="padding:10px 0;border-bottom:1px solid #d9d4c6;font-size:14px;line-height:20px;overflow-wrap:anywhere;word-break:break-word;"><a href="${escapeHtml(url)}" style="color:#151b46;text-decoration:underline;">${escapeHtml(url)}</a></td>
  </tr>` : "",
  ].join("\n")).join("\n")}
</table>`;
  const bodyText = tracking.length === 0 ? "" : `Tracking
${tracking.map(({ number, url }) => [
    number ? `Tracking number\t${number}` : "",
    url ? `Tracking link\t${url}` : "",
  ].filter(Boolean).join("\n")).join("\n")}`;

  return renderTransactionalEmail({
    subject,
    preheader: `${subject}.`,
    status: "Shipped",
    orderNumber,
    bodyHtml,
    bodyText,
  });
}

export function renderDeliveryNotification(input: {
  readonly displayId: number | string;
}): EmailContent {
  const orderNumber = `#${String(input.displayId)}`;
  const subject = `Order ${orderNumber} delivered`;

  return renderTransactionalEmail({
    subject,
    preheader: `${subject}.`,
    status: "Delivered",
    orderNumber,
    bodyHtml: "",
    bodyText: "",
  });
}
