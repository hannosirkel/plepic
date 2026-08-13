import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("https://challenges.cloudflare.com/**", async (route) => {
    await route.fulfill({ contentType: "application/javascript", body: `window.turnstile={render:(e)=>{e.innerHTML='<input type="hidden" name="cf-turnstile-response" value="">';return 'fixture'},reset:()=>{document.querySelector('[name=cf-turnstile-response]').value=''}}` });
  });
});

async function supplyTurnstileResponse(page: Page, value: string): Promise<void> {
  await page.locator('[name="cf-turnstile-response"]').evaluate(
    (element, response) => { (element as HTMLInputElement).value = response; },
    value,
  );
}

const visualRoutes = [
  ["home", "/"],
  ["lunar-base", "/games/lunar-base"],
  ["about", "/about"],
  ["support", "/support/lunar-base"],
  ["rulebook", "/support/lunar-base/rulebook"],
  ["cart", "/cart?mock=filled"],
  ["checkout", "/checkout?mock=filled"],
  ["imprint", "/legal/imprint"],
  ["privacy", "/legal/privacy"],
  ["returns", "/legal/returns"],
  ["shipping", "/legal/shipping"],
  ["terms", "/legal/terms"],
  ["localized-imprint", "/et/legal/imprint"],
  ["not-found", "/definitely-not-found"],
] as const;

async function dismissConsentForInteraction(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Decline" }).click();
}

for (const [name, path] of visualRoutes) {
  test(`${name} preserves the default consent state without loading analytics`, async ({ page }, testInfo) => {
    const analyticsRequests: string[] = [];
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    // Keep the route-level screenshot/error matrix deterministic and scoped
    // to this application. The dedicated below-fold media test separately
    // verifies both approved YouTube requests and the CSP boundary.
    await page.route("https://www.youtube-nocookie.com/**", async (route) => {
      await route.fulfill({ status: 200, contentType: "text/html", body: "" });
    });
    await page.route("**://www.googletagmanager.com/**", async (route) => {
      analyticsRequests.push(route.request().url());
      await route.abort();
    });
    page.on("request", (request) => {
      if (request.url().includes("googletagmanager.com")) analyticsRequests.push(request.url());
    });

    const response = await page.goto(path);
    expect(response).not.toBeNull();
    await expect(page.getByRole("dialog", { name: "Cookie and analytics consent" })).toBeVisible();
    await expect.poll(() => analyticsRequests).toEqual([]);
    await expect(page).toHaveScreenshot(`${name}-${testInfo.project.name}.png`, {
      // Viewport captures keep the committed evidence within the repository's
      // derivative-asset ceiling while covering each responsive composition.
      fullPage: false,
    });
    await expect.poll(() => analyticsRequests).toEqual([]);
    await expect(page.locator("script[src*='googletagmanager.com']")).toHaveCount(0);
    expect(pageErrors).toEqual([]);
    if (name === "not-found") {
      expect(response?.status()).toBe(404);
      expect(consoleErrors).toEqual(["Failed to load resource: the server responded with a status of 404 (Not Found)"]);
    } else {
      expect(response?.status()).toBeLessThan(400);
      expect(consoleErrors).toEqual([]);
    }
    await page.getByRole("button", { name: "Agree" }).click();
    await expect.poll(() => analyticsRequests.length).toBeGreaterThan(0);
  });
}

test("mobile menu supports disclosure semantics, Escape, close, and focus return", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "The disclosure exists only at the mobile breakpoint.");
  await page.goto("/");
  await dismissConsentForInteraction(page);

  const menu = page.getByRole("button", { name: "Menu", exact: true });
  const navigation = page.getByRole("navigation", { name: "Primary" });
  const close = navigation.getByRole("button", { name: "Close menu" });
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await menu.focus();
  await page.keyboard.press("Enter");
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  await expect(navigation).toBeVisible();
  await expect(close).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(navigation.getByRole("link", { name: "Lunar Base" })).toBeFocused();
  await expect(navigation.getByRole("link", { name: "Lunar Base" })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(menu).toBeFocused();

  await menu.click();
  await close.click();
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(menu).toBeFocused();
});

test("below-fold product media loads when reached and approved videos use privacy-enhanced frames", async ({ page }, testInfo) => {
  if (testInfo.project.name === "desktop") {
    await page.setViewportSize({ width: 1000, height: 900 });
  }
  const youtubeRequests: string[] = [];
  const cspErrors: string[] = [];
  await page.route("https://www.youtube-nocookie.com/**", async (route) => {
    youtubeRequests.push(route.request().url());
    await route.abort();
  });
  page.on("console", (message) => {
    if (message.type() === "error" && message.text().includes("Content Security Policy")) {
      cspErrors.push(message.text());
    }
  });

  await page.goto("/games/lunar-base");
  await dismissConsentForInteraction(page);
  const tableImage = page.locator("img[src*='/images/table/table-view-']");
  await tableImage.scrollIntoViewIfNeeded();
  await expect.poll(() => tableImage.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await expect(tableImage.locator("..")).toHaveScreenshot(`lunar-table-${testInfo.project.name}.png`);

  const watch = page.locator("#video_trailer");
  await watch.scrollIntoViewIfNeeded();
  const frames = page.locator("iframe[src*='youtube-nocookie.com']");
  await expect(frames).toHaveCount(2);
  await expect(frames.nth(0)).toHaveAttribute("src", "https://www.youtube-nocookie.com/embed/2D_y7t7DDYM");
  await expect(frames.nth(1)).toHaveAttribute("src", "https://www.youtube-nocookie.com/embed/SOW3l7kdu7k");
  await expect.poll(() => youtubeRequests.length).toBe(2);
  await expect(watch).toHaveScreenshot(`lunar-watch-${testInfo.project.name}.png`);
  expect(cspErrors).toEqual([]);
});

test("below-fold homepage story loads the authentic team photograph", async ({ page }, testInfo) => {
  await page.goto("/");
  await dismissConsentForInteraction(page);
  const story = page.locator("#story");
  const teamImage = story.locator("img[src*='/images/team/team-']");
  await story.scrollIntoViewIfNeeded();
  await expect.poll(() => teamImage.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await expect(story).toHaveScreenshot(`home-story-${testInfo.project.name}.png`);
});

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
  await supplyTurnstileResponse(page, "synthetic-checkout-token");
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

test("payment return renews Turnstile and completes only on Medusa order", async ({ page }, testInfo) => {
  const cartId = `cart_return_${testInfo.project.name}_${testInfo.workerIndex}`;
  await page.addInitScript((id) => sessionStorage.setItem("plepic.medusa.cart-id", id), cartId);
  await page.goto("/checkout/payment-return");
  await expect(page.getByText("€25.00", { exact: true })).toBeVisible();
  await expect(page.getByText("€32.00", { exact: true })).toBeVisible();
  const form = page.locator("form");
  await expect(form).toHaveAttribute("method", "post");
  await expect(form).toHaveAttribute("action", "/checkout/payment-return/order");
  await expect(form.locator('[name="cf-turnstile-response"]')).toHaveValue("");
  await page.getByRole("button", { name: "Order with obligation to pay" }).click();
  await expect.poll(async () => (await page.request.get(`http://127.0.0.1:3199/inspect/${cartId}`)).json()).toEqual({ tokens: [] });
  await supplyTurnstileResponse(page, "synthetic-return-token-one");
  await page.getByRole("button", { name: "Order with obligation to pay" }).dblclick();
  await expect.poll(async () => (await page.request.get(`http://127.0.0.1:3199/inspect/${cartId}`)).json()).toEqual({ tokens: ["synthetic-return-token-one"] });
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem("plepic.medusa.cart-id"))).toBe(cartId);
  await expect(form.locator('[name="cf-turnstile-response"]')).toHaveValue("");
  await supplyTurnstileResponse(page, "synthetic-return-token-two");
  await page.getByRole("button", { name: "Order with obligation to pay" }).click();
  await expect.poll(async () => (await page.request.get(`http://127.0.0.1:3199/inspect/${cartId}`)).json()).toEqual({ tokens: ["synthetic-return-token-one", "synthetic-return-token-two"] });
  await expect(page.getByText("Order confirmed")).toBeVisible();
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem("plepic.medusa.cart-id"))).toBeNull();
});
