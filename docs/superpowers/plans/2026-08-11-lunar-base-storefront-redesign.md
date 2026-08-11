# Lunar Base Storefront Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the existing Plepic Medusa storefront into the approved polished Lunar Base shop without changing copy, routes, data, commerce behaviour, or environment boundaries.

**Architecture:** Keep the existing Next.js route/component structure and the publisher/Lunar semantic token layers. Bind cleared assets and verified videos in the existing page components, then restyle shared primitives and route CSS modules into the approved editorial/full-bleed system. Browser screenshots and interaction tests remain the rendered contract.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, CSS Modules, Vitest, Playwright.

## Global Constraints

- Work only on `codex/big-improve-ui`; one branch and one future PR.
- Preserve all storefront copy verbatim and retain existing routes, catalogue/runtime data, server actions, CSP, consent, checkout, structured data, and legal behaviour.
- Use only cleared authentic assets documented in `docs/asset-inventory.md`; fabricate no products, people, reviews, awards, or claims.
- Components consume semantic/component tokens from `design/tokens.css`; do not introduce component-level literal colours.
- Maintain WCAG 2.2 AA, keyboard operation, reduced motion, explicit image dimensions, responsive sources, and honest pending/empty states.
- Run focused tests during each task and `bash scripts/validate` before handoff. Because Next's detached TypeScript subprocess loses output in the sandbox, build-containing checks run outside it.

---

### Task 1: Bind approved product assets and videos

**Files:**
- Modify: `storefront/tests/design-assets.test.tsx`
- Modify: `storefront/tests/support-page.test.tsx`
- Modify: `storefront/src/components/mockups/HomepageMockup.tsx`
- Modify: `storefront/src/components/mockups/LunarBaseMockup.tsx`
- Modify: `storefront/src/components/pages/SupportPageContent.tsx`
- Create: responsive derivatives under `storefront/public/images/`

**Interfaces:**
- Consumes: existing `VideoEmbed` props and responsive-image HTML pattern.
- Produces: authentic homepage product cut-out, cinematic table photography, official trailer ID `2D_y7t7DDYM`, tutorial ID `SOW3l7kdu7k`, and line-art background asset.

- [x] **Step 1: Write failing tests** asserting the rendered homepage selects the approved front/back cut-out, the product page selects the real table scene and official video IDs, and support selects the verified tutorial.
- [x] **Step 2: Verify RED** with `npm -w storefront run test:unit -- design-assets.test.tsx support-page.test.tsx`; expect assertions to fail because current components use the open-box/table diagram and `null` video IDs.
- [x] **Step 3: Export approved derivatives** from the exact sources in `docs/asset-inventory.md` using lossless source reads and responsive WebP outputs; do not modify source masters.
- [x] **Step 4: Implement the bindings** in the existing components with explicit dimensions, `srcSet`, `sizes`, loading priority, evidence-based alternative text, and no copy changes.
- [x] **Step 5: Verify GREEN** with the same focused Vitest command.

### Task 2: Rebuild the shared visual shell

**Files:**
- Modify: `design/tokens.css`
- Modify: `design/README.md` only if a token contract changes
- Modify: `storefront/src/styles/global.css`
- Modify: `storefront/src/styles/site-header.module.css`
- Modify: `storefront/src/styles/site-footer.module.css`
- Modify: `storefront/src/styles/mockups/call-to-action.module.css`
- Modify: `storefront/src/styles/forms.module.css`
- Modify: `storefront/src/styles/consent-manager.module.css`
- Modify: related token/chrome tests only for observable behaviour

**Interfaces:**
- Consumes: existing `data-layer="publisher"` and `data-layer="lunar"` semantics.
- Produces: one responsive editorial shell, square action language, full-width section primitive, restrained consent surface, and unchanged navigation/form semantics.

- [x] **Step 1: Run existing token and chrome tests** to establish the green behavioral baseline.
- [x] **Step 2: Implement the approved shell styles** without literal component colours or component-library additions.
- [x] **Step 3: Run token, chrome, form, consent, and locale-navigation tests** and correct regressions.
- [x] **Step 4: Render header/footer/form states at 1440, 768, and 390 px** and repair overflow, focus, and touch-target issues.

### Task 3: Transform homepage and Lunar Base product page

**Files:**
- Modify: `storefront/src/styles/mockups/homepage.module.css`
- Modify: `storefront/src/styles/mockups/lunar-base.module.css`
- Modify: `storefront/src/styles/feature-spec-strip.module.css`
- Modify: `storefront/src/styles/proof-strip.module.css`
- Modify: `storefront/src/styles/purchase-panel.module.css`
- Modify: `storefront/src/styles/review-composite.module.css`
- Modify: `storefront/src/styles/product-safety.module.css`
- Modify: `storefront/src/components/mockups/HomepageMockup.tsx` and `LunarBaseMockup.tsx` only where section wrappers/media composition require it

**Interfaces:**
- Consumes: Task 1 media and Task 2 shared shell.
- Produces: approved off-white editorial homepage and cinematic full-bleed Lunar product page.

- [x] **Step 1: Run existing page rendering/unit tests** to preserve content, link, catalogue, price, and safety contracts.
- [x] **Step 2: Implement the homepage composition** with asymmetric product hero, ruled proof strip, immersive featured-game band, editorial story/team sequence, and compact newsletter.
- [x] **Step 3: Implement the Lunar composition** with cosmic hero, purchase clarity, launch-site spec language, textured component spread, open rules/victory rhythm, real table photography, videos, and restrained close.
- [x] **Step 4: Run the focused unit suite** and repair semantic/content regressions.
- [x] **Step 5: Run Playwright screenshots at desktop/mobile**; update baselines only after inspecting every changed capture against the approved guide.

### Task 4: Transform publisher, support, commerce, and legal routes

**Files:**
- Modify: `storefront/src/styles/pages/about.module.css`
- Modify: `storefront/src/styles/team-photo-section.module.css`
- Modify: `storefront/src/styles/pages/support.module.css`
- Modify: `storefront/src/styles/pages/rulebook.module.css`
- Modify: `storefront/src/styles/pages/shop.module.css`
- Modify: `storefront/src/styles/pages/legal.module.css`
- Modify: `storefront/src/styles/pages/not-found.module.css`
- Modify components only where an approved media wrapper or semantic layout hook is absent.

**Interfaces:**
- Consumes: shared shell, existing page data, and unchanged route components.
- Produces: editorial about/legal pages, service-first support/rulebook pages, and clearer cart/checkout hierarchy at all breakpoints.

- [x] **Step 1: Run existing about/support/rulebook/shop/legal tests** as the behavioral baseline.
- [x] **Step 2: Implement each route treatment** from `docs/style-guide.md`, preserving all source text and operational logic.
- [x] **Step 3: Run the same focused tests** and repair regressions.
- [x] **Step 4: Render every route at 1440 and 390 px**, plus checkout/form routes at 768 px; repair overflow, overlay, hierarchy, and keyboard issues.

### Task 5: Full rendered QA and completion verification

**Files:**
- Modify: `storefront/tests/playwright/storefront.spec.ts` only when a durable interaction/accessibility assertion is missing.
- Update: `storefront/tests/screenshots/*.png` after inspection.
- Update: `docs/asset-inventory.md` and `docs/style-guide.md` from proposed to implemented only after QA passes.

**Interfaces:**
- Consumes: all implemented route/system tasks.
- Produces: a clean diff, reviewed screenshots, passing browser/unit/build checks, and a ready single-branch handoff.

- [x] **Step 1: Run the full Playwright suite** outside the sandbox with console/page-error capture and inspect every desktop/mobile screenshot.
- [x] **Step 2: Run keyboard, focus, reduced-motion, mobile-menu, consent, cart, checkout-validation, rulebook, and video checks**; add a failing regression assertion before any functional repair.
- [x] **Step 3: Run `git diff --check`, inspect all binary/source changes, and review outgoing history**; keep `.githooks/pre-commit` enabled.
- [x] **Step 4: Run `bash scripts/validate` fresh outside the sandbox**, then run the production build and a second rendered smoke pass.
- [x] **Step 5: Mark documentation implemented and prepare the single-branch handoff** only if every verification exits zero and no QA row remains open.
