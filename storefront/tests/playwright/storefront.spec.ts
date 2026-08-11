import { expect, test, type Page } from "@playwright/test";

const visualRoutes = [
  ["home", "/"],
  ["lunar-base", "/games/lunar-base"],
  ["cart", "/cart?mock=filled"],
  ["checkout", "/checkout?mock=filled"],
] as const;

async function dismissConsentForInteraction(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Decline" }).click();
}

for (const [name, path] of visualRoutes) {
  test(`${name} preserves the default consent state without loading analytics`, async ({ page }, testInfo) => {
    const analyticsRequests: string[] = [];
    await page.route("**://www.googletagmanager.com/**", async (route) => {
      analyticsRequests.push(route.request().url());
      await route.abort();
    });
    page.on("request", (request) => {
      if (request.url().includes("googletagmanager.com")) analyticsRequests.push(request.url());
    });

    await page.goto(path);
    await expect(page.getByRole("dialog", { name: "Cookie and analytics consent" })).toBeVisible();
    await expect.poll(() => analyticsRequests).toEqual([]);
    await expect(page).toHaveScreenshot(`${name}-${testInfo.project.name}.png`, {
      // Viewport captures keep the committed evidence within the repository's
      // derivative-asset ceiling while covering each responsive composition.
      fullPage: false,
    });
    await expect.poll(() => analyticsRequests).toEqual([]);
    await expect(page.locator("script[src*='googletagmanager.com']")).toHaveCount(0);
    await page.getByRole("button", { name: "Agree" }).click();
    await expect.poll(() => analyticsRequests.length).toBeGreaterThan(0);
  });
}

async function completeAddress(page: Page): Promise<void> {
  await page.getByLabel("Full name").fill("Ada Lovelace");
  await page.getByLabel("Street and number").fill("1 Example Street");
  await page.getByLabel("Postcode").fill("10115");
  await page.getByLabel("Town or city").fill("Tallinn");
  await page.getByLabel("Country").selectOption({ label: "Estonia" });
  await page.getByLabel("Email address").fill("ada@example.test");
}

for (const refusal of ["above-max", "cleared", "negative"] as const) {
  test(`quantity control refuses ${refusal} input without changing the basket`, async ({ page }) => {
    await page.goto("/cart?mock=filled");
    const quantity = page.getByRole("spinbutton", { name: /quantity of lunar base/i });
    const line = page.getByRole("listitem").filter({ hasText: "Lunar Base" });
    const summary = page.getByRole("heading", { name: "Order summary" }).locator("..");

    await dismissConsentForInteraction(page);
    await expect(quantity).toHaveValue("1");
    await expect(line).toContainText("€25.00");
    await expect(summary).toContainText("€25.00");
    const maximum = Number(await quantity.getAttribute("max"));
    expect(Number.isInteger(maximum)).toBe(true);
    const refusedValue =
      refusal === "above-max" ? String(maximum + 1) : refusal === "cleared" ? "" : "-1";
    await quantity.fill(refusedValue);
    await page.getByRole("button", { name: /update the quantity of lunar base/i }).click();

    await expect(quantity).toHaveValue(refusedValue);
    await expect(page.getByRole("alert").filter({ hasText: "Your basket has not been changed." })).toContainText(
      `Enter a whole number of copies, from 1 to ${String(maximum)}. Your basket has not been changed.`,
    );
    // The edited control is deliberately not evidence of the basket. These
    // independent line and summary figures must both remain at one copy.
    await expect(line).toContainText("€25.00");
    await expect(summary).toContainText("€25.00");
  });
}

test("Article 8(2) invariant: no order placement succeeds where all six Article 8(2) values are not displayed as values", async ({ page }) => {
  await page.goto("/checkout?mock=filled");
  await dismissConsentForInteraction(page);
  const order = page.getByRole("button", { name: "Order with obligation to pay" });

  await expect(order).toBeVisible();
  // Goods, their price and the delivery estimate have values; the delivery
  // address, charge and total are instructions until an address is complete.
  await expect(page.getByText("Enter your delivery address above.")).toBeVisible();
  await expect(page.getByText("Enter your delivery address to see the shipping charge.")).toHaveCount(2);
  await expect(page.getByText("Shown once your delivery address is complete")).toBeVisible();
  await order.click();

  await expect(page.getByRole("alert").filter({ hasText: "Check the details you entered" })).toContainText("Check the details you entered");
  await expect(page).toHaveURL(/\/checkout\?mock=filled$/);
  await expect(order).toBeVisible();

  // Positive control: a complete available order shows all six values and
  // reaches the known mock-payment outcome, proving this test can observe the
  // path that the missing-disclosure states must not reach.
  await completeAddress(page);
  const orderSummary = page.getByRole("heading", { name: "Your order" }).locator("..");
  await expect(orderSummary.getByText("€7.00", { exact: true })).toBeVisible();
  await expect(orderSummary.getByText("€32.00", { exact: true })).toBeVisible();
  await order.click();
  await expect(page.getByRole("alert").filter({ hasText: "card payment is not connected" })).toContainText(
    "No order was placed and nothing was charged: card payment is not connected on this site yet.",
  );

  // A different reachable state with an unavailable line withholds the goods
  // price and total themselves; it too cannot create a successful placement.
  await page.goto("/checkout?mock=unavailable");
  await completeAddress(page);
  await expect(page.getByText("Shown once your basket holds only items we can supply")).toHaveCount(2);
  await expect(order).toHaveAttribute("aria-disabled", "true");
  // `aria-disabled` intentionally remains focusable. Force the actual click
  // through its visual-disabled affordance to exercise the form handler's
  // Article 8(2) refusal rather than merely Playwright's actionability guard.
  await order.click({ force: true });
  await expect(page.getByRole("alert").filter({ hasText: "Remove the item we cannot supply before ordering." })).toContainText("Remove the item we cannot supply before ordering.");
  await expect(page).toHaveURL(/\/checkout\?mock=unavailable$/);
  await expect(order).toHaveAttribute("aria-disabled", "true");
  await page.waitForTimeout(500);
  await expect(page.getByRole("alert").filter({ hasText: "card payment is not connected" })).toHaveCount(0);
});
