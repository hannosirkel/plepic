import { useState } from "react";

import { defineWidgetConfig } from "@medusajs/admin-sdk";
import { Button, Container, Heading, Text, toast } from "@medusajs/ui";
import type { AdminOrder, DetailWidgetProps } from "@medusajs/framework/types";

/**
 * Reaches the Omniva label from the order page — the last piece of the
 * Omniva feature, and a repair tool as much as a download button.
 *
 * ## Why a barcode with no stored label is not a bug this widget should hide
 *
 * `../../modules/omniva/service.ts`'s `createFulfillment` registers a real
 * parcel with Omniva and *then*, in a second, separately-caught call, asks
 * Omniva for that parcel's PDF label. That second call is deliberately
 * allowed to fail without failing the fulfilment: registration cannot be
 * undone, so if a label timeout rolled the fulfilment back, an operator's
 * retry would call `createFulfillment` again from the top and register a
 * *second* parcel — a second carrier charge for what may have been nothing
 * more than a slow response from Omniva. So a fulfilment can legitimately
 * carry an Omniva `barcode` and **no** `label_pdf_base64`, and this widget's
 * whole reason to exist is to make that state repairable from the Admin
 * rather than requiring a database edit. A future reader who does not know
 * this and "fixes" the widget to always expect a label, or to treat a
 * missing one as broken data, would be removing the one place this gap can
 * be closed by hand.
 *
 * ## Why both buttons call the same route
 *
 * **Download label** and **Request label** are the same HTTP call:
 * `GET /admin/omniva/labels/:barcode`
 * (`../../api/admin/omniva/labels/[barcode]/route.ts`). That route already
 * decides, server-side, whether to serve a stored PDF or re-request one —
 * see its own docstring and `../../fulfillment/omniva-label.ts`'s. This
 * widget does not duplicate that branching; it only chooses which label to
 * put on the button, from whether *this render* already knows of a stored
 * PDF, and triggers a browser download from whatever bytes come back
 * either way.
 *
 * ## Why this reads `order.fulfillments` rather than fetching its own copy
 *
 * The order details page's own query already asks for `*fulfillments`
 * (confirmed against `@medusajs/dashboard`'s built `order-detail-*.mjs`,
 * which pulls in a chunk listing exactly that field) — a Medusa "expand this
 * relation's own fields" selector that includes `data` and `provider_id`,
 * the two fields this widget needs. A widget fetching its own copy of the
 * same order the page just fetched would be a second round trip for data
 * already sitting in `props.data`, so this widget reads it from there
 * instead, the same way the personalised-order-items widget in Medusa's own
 * documentation reads `item.metadata` straight off the `order` prop.
 *
 * ## Why a non-Omniva order renders nothing
 *
 * Every row below requires both `provider_id === OMNIVA_FULFILLMENT_PROVIDER_ID`
 * and a `data.barcode` string — the one field only
 * `OmnivaFulfillmentProviderService.createFulfillment` ever writes, and only
 * onto an Omniva fulfilment. A manual-delivery order's fulfilments carry
 * neither, so {@link omnivaRows} returns an empty array and this component
 * returns `null` rather than an empty `Container` — every order placed
 * through Standard delivery must see nothing here at all, not a box with
 * nothing in it.
 */

/**
 * `OMNIVA_FULFILLMENT_PROVIDER_ID` from `../../commerce/shipping-model.ts`,
 * redeclared rather than imported. That file is written for, and pulled
 * into, the backend's own server bundle (it pulls in a full country-code
 * table for reasons entirely unrelated to this one constant); this file
 * ships into the Admin dashboard's separate browser bundle, and importing
 * across that boundary for one string is not worth coupling the two builds.
 * `../../../tests/omniva-provider.test.ts` already asserts the constant this
 * mirrors stays `omniva_omniva`, which is what keeps this copy honest.
 */
const OMNIVA_FULFILLMENT_PROVIDER_ID = "omniva_omniva";

interface OmnivaFulfillmentRow {
  readonly fulfillmentId: string;
  readonly barcode: string;
  readonly hasStoredLabel: boolean;
}

function barcodeOf(data: Record<string, unknown> | null | undefined): string | null {
  const value = data?.barcode;
  return typeof value === "string" && value.length > 0 ? value : null;
}

function hasStoredLabel(data: Record<string, unknown> | null | undefined): boolean {
  const value = data?.label_pdf_base64;
  return typeof value === "string" && value.length > 0;
}

function omnivaRows(order: AdminOrder): OmnivaFulfillmentRow[] {
  const rows: OmnivaFulfillmentRow[] = [];
  for (const fulfillment of order.fulfillments ?? []) {
    if (fulfillment.provider_id !== OMNIVA_FULFILLMENT_PROVIDER_ID) continue;
    const barcode = barcodeOf(fulfillment.data);
    if (barcode === null) continue;
    rows.push({
      fulfillmentId: fulfillment.id,
      barcode,
      hasStoredLabel: hasStoredLabel(fulfillment.data),
    });
  }
  return rows;
}

/**
 * The one HTTP call both buttons make. `credentials: "include"` is what
 * carries the Admin's own session cookie — this repository has no
 * `@medusajs/js-sdk` dependency to reach for (adding one is outside this
 * task's scope; see the task brief's "no npm dependency" constraint), and a
 * same-origin `fetch` with the session cookie attached is exactly what that
 * SDK's own client does under the hood for `auth: { type: "session" }`. The
 * route this calls is under `/admin`, so it 401s without that cookie —
 * `../../api/admin/omniva/labels/[barcode]/route.ts`'s own docstring names
 * the framework code that enforces this; nothing here could bypass it even
 * if it tried.
 */
async function downloadOmnivaLabel(barcode: string): Promise<void> {
  const response = await fetch(`/admin/omniva/labels/${encodeURIComponent(barcode)}`, {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/pdf" },
  });

  if (!response.ok) {
    let message = `Omniva answered ${String(response.status)}`;
    try {
      const body = (await response.json()) as { message?: unknown };
      if (typeof body.message === "string" && body.message.length > 0) {
        message = body.message;
      }
    } catch {
      // The error body was not JSON; the status-based message above stands.
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `omniva-${barcode}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

const OmnivaLabelWidget = ({ data: order }: DetailWidgetProps<AdminOrder>) => {
  const rows = omnivaRows(order);
  const [pendingId, setPendingId] = useState<string | null>(null);
  // Fulfilments whose label this render has confirmed exists, beyond what
  // `row.hasStoredLabel` already knew when the order was fetched -- set the
  // instant a "Request label" click succeeds, so the button reads "Download
  // label" without waiting on the order page's own data to refetch.
  const [confirmedLabels, setConfirmedLabels] = useState<ReadonlySet<string>>(new Set());

  if (rows.length === 0) return null;

  const handleClick = async (row: OmnivaFulfillmentRow) => {
    setPendingId(row.fulfillmentId);
    try {
      await downloadOmnivaLabel(row.barcode);
      setConfirmedLabels((current) => new Set(current).add(row.fulfillmentId));
      toast.success("Omniva label downloaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The Omniva label could not be retrieved");
    } finally {
      setPendingId(null);
    }
  };

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Omniva label</Heading>
      </div>
      <div className="divide-y">
        {rows.map((row) => {
          const labelIsReady = row.hasStoredLabel || confirmedLabels.has(row.fulfillmentId);
          return (
            <div key={row.fulfillmentId} className="flex items-center justify-between px-6 py-4">
              <Text size="small" className="font-mono">{row.barcode}</Text>
              <Button
                size="small"
                variant={labelIsReady ? "secondary" : "primary"}
                isLoading={pendingId === row.fulfillmentId}
                onClick={() => void handleClick(row)}
              >
                {labelIsReady ? "Download label" : "Request label"}
              </Button>
            </div>
          );
        })}
      </div>
    </Container>
  );
};

export const config = defineWidgetConfig({
  zone: "order.details.side",
});

export default OmnivaLabelWidget;
