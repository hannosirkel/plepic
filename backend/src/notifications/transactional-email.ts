/*
 * Adapted from ActiveCampaign/Postmark's MIT-licensed transactional receipt
 * template. The full upstream license is in LICENSE.postmark-templates.
 */

export interface EmailContent {
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function formatMoney(value: number, currencyCode: string): string {
  if (!Number.isFinite(value)) {
    throw new Error("Money value must be finite");
  }

  const currency = currencyCode.toUpperCase();
  const amount = new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

  return `${amount.replaceAll("\u00a0", "")} ${currency}`;
}

export function renderTransactionalEmail(input: {
  readonly subject: string;
  readonly preheader: string;
  readonly status: string;
  readonly orderNumber: string;
  readonly bodyHtml: string;
  readonly bodyText: string;
}): EmailContent {
  const subjectHtml = escapeHtml(input.subject);
  const preheaderHtml = escapeHtml(input.preheader);
  const statusHtml = escapeHtml(input.status);
  const orderNumberHtml = escapeHtml(input.orderNumber);

  return {
    subject: input.subject,
    text: `${input.subject}\n\nStatus\t${input.status}\nOrder\t${input.orderNumber}\n\n${input.bodyText}`,
    html: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <title>${subjectHtml}</title>
</head>
<body style="margin:0;padding:0;background:#f7f4ec;color:#151b46;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheaderHtml}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#f7f4ec;">
    <tr>
      <td align="center" style="padding:32px 12px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #d9d4c6;">
          <tr>
            <td style="padding:22px 28px;background:#151b46;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:.02em;">Plepic Games</td>
          </tr>
          <tr>
            <td style="padding:32px 28px 12px;">
              <div style="font-size:13px;line-height:20px;text-transform:uppercase;letter-spacing:.08em;color:#151b46;">${orderNumberHtml}</div>
              <h1 style="margin:4px 0 0;font-size:28px;line-height:36px;color:#151b46;">${statusHtml}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 20px 32px;">${input.bodyHtml}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  };
}
