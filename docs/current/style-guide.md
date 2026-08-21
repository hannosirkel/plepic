# Lunar Base storefront direction

Status: implemented, 2026-08-11. This guide records the visual system now used by the storefront.

## Direction in one sentence

Build a quiet, editorial Plepic shop that opens into an immersive Lunar Base world: generous off-white publisher pages, full-bleed midnight product bands, real game artifacts at large scale, and crisp square controls taken from the original launch site rather than a generic card-grid storefront.

## Reference authority

1. Primary visual authority: `https://lunarbasegame.com` — brand language, dark palette, typography, outlined controls, full-bleed rhythm, component-spread texture, responsive collapse.
2. Secondary commerce reference: `https://shop.plepic.com` — only current product/price and familiar shop information hierarchy. Its generic Astra/WooCommerce styling is not a design target.
3. Current local storefront — authoritative for routes, content, behaviour, accessibility decisions, runtime configuration, catalogue values, and legal/compliance copy.

Measured reference captures:

- Desktop, 1440 px: `/tmp/lunarbasegame-desktop.png` and `/tmp/plepic-shop-desktop.png`
- Mobile, 390 px: `/tmp/lunarbasegame-mobile.png` and `/tmp/plepic-shop-mobile.png`

The launch site uses a roughly 1200 px desktop content width with 120 px gutters at 1440 px, 150 px vertical section spacing, a 978 px cinematic desktop hero, and 20–30 px mobile gutters/section spacing. The storefront should inherit the relationships, not reproduce a fixed-height marketing page.

## Design tokens

The existing three-layer token architecture in `design/tokens.css` remains authoritative. Components consume semantic/component tokens only; they do not reach into brand ramps or introduce literal colours.

### Colour

| role | publisher | Lunar Base |
|---|---|---|
| canvas | `#F7F4EC` | `#080C23` |
| raised surface | `#FFFFFF` | `#111732` |
| sunken band | `#151B46` | `#0D0D3B` |
| primary text | `#151B46` | `#D6D7E3` |
| secondary text | `#454B70` | `#B8BAD1` |
| subtle text | `#5A6084` | `#858AA2` |
| readable link/accent | `#186E82` | `#25A8C5` |
| brand orange CTA | `#F06432` with navy text | same |
| warm highlight/positive | `#F2B63D` | `#F2B63D` |
| decorative Lunar line | n/a | `#386693`, `#585C77`, `#2E3041` |

All existing documented WCAG 2.2 AA pairings stay intact. Cyan, orange, gold, and low-contrast Lunar lines are decorative fills unless the semantic token documentation explicitly allows text.

### Type

- Primary family: MADE Evolve Sans, with the existing geometric fallback stack. Use only licensed WOFF/WOFF2 and preserve the complete Fontspring licence banner; never ship OTF.
- Display: bold/medium, tight tracking, short line lengths. Product headings may use the launch-site boxed/outlined composition but remain live HTML text.
- Body: regular/light, relaxed 1.5–1.6 line height. Do not reproduce the launch site’s 30 px desktop body size everywhere; reserve that scale for a single product lede.
- Proposed responsive scale: 14, 16, 18, 22, 30, 42, 60 px; clamp display steps between mobile and desktop. Keep legal/support reading copy near 16–18 px and 65–72 characters.

### Layout, spacing, and shape

- Max content width: 1200 px; editorial reading width: 760 px; checkout/form width follows existing usability constraints.
- Desktop page gutters: clamp from 24 px to 72 px; wide screens may reach the reference’s 120 px visual gutter through centered max-width containers.
- Mobile gutters: 20 px. Section rhythm: 64–112 px desktop, 40–64 px mobile; only cinematic product bands may reach 128–150 px.
- Primary grid: 12 columns desktop, 6 tablet, one compositional column mobile. Product hero and purchase areas use asymmetric 7/5 or 6/6 splits.
- Corners: square to 4 px for controls and graphic frames; 8–12 px only where a raised commerce/form surface needs containment. No pill-shaped page furniture and no field of floating rounded cards.
- Borders: one-pixel semantic hairlines; high-contrast interactive boundaries. Shadows are restrained and limited to product cut-outs or necessary commerce elevation, never every section.

### Interaction and motion

- Buttons are crisp rectangular fills or one-pixel outlines, echoing the launch site. Primary purchase remains orange with navy text; dark-page secondary actions use a high-contrast outline.
- Hover/focus: small colour and 1–2 px positional shifts only. Product art may drift by at most 6–10 px over 400–600 ms on hover-capable devices.
- Section reveals are optional, brief (200–350 ms), and opacity/translate only. `prefers-reduced-motion` removes all nonessential transforms and autoplay.
- Mobile navigation, forms, quantity changes, consent, checkout, and videos preserve current semantics and keyboard behaviour. Touch targets remain at least 44 × 44 px.

## Asset-to-role map

| role | exact selected source |
|---|---|
| Default Plepic mark | `/home/hanno/plepicfiles/vector/plepic-games-wordmark-primary.svg` |
| Dark-surface Plepic mark | `/home/hanno/plepicfiles/vector/plepic-games-wordmark-dark-background.svg` |
| Lunar wordmark | `/home/hanno/lunarfiles/Web/Elements/Lunar Base website logo v1.svg` |
| Homepage product hero | `/home/hanno/lunarsnips/LB pics TRANSPARENT/LB box front and back transparent 2_1.png` |
| Product purchase hero | `/home/hanno/lunarsnips/LB pics TRANSPARENT/LB box open 3_1.png` |
| Lunar atmosphere | `/home/hanno/lunarfiles/Web/Elements/Hero image 1920 x 1200.jpg` |
| Component-band texture | `/home/hanno/lunarfiles/Web/Elements/About Game background.jpg` |
| Cards/component spread | `/home/hanno/lunarfiles/Web/Elements/Hand cards.png` and `/home/hanno/lunarfiles/Web/Elements/Layed out card base.png` |
| Cinematic table scene | `/home/hanno/lunarsnips/Lunar Baes table view v1.jpg` |
| Secondary real play scene | `/home/hanno/lunarsnips/lunar_base_game.JPG` |
| About team | `/home/hanno/lunarsnips/lbteam.jpg` |
| Trailer | `https://www.youtube.com/watch?v=2D_y7t7DDYM` |
| Tutorial | `https://www.youtube.com/watch?v=SOW3l7kdu7k` |

No generative asset is proposed. The real cleared material covers every visual role.

## Shared-component treatment

- Header: a light publisher variant and transparent/dark Lunar variant from one semantic component. Keep the Plepic wordmark dominant, simplify nav spacing, retain locale/cart behaviour, and use a compact sheet on mobile.
- Footer: editorial publisher footer on light routes; Lunar-toned closing band on product/rulebook routes. Preserve every current legal and support destination.
- Calls to action: one rectangular system with primary, outline, and quiet text styles. Purchase language and targets remain unchanged.
- Section primitives: full-width bands with centered inner grids; typographic rules and texture replace most generic card containers.
- Product facts/proof: open horizontal strips on desktop and a clean two-column/stacked layout on mobile; no floating glass cards.
- Forms: strong labels, quiet help text, visible validation, rectangular fields, and a contained action area. Turnstile, honeypot, runtime-config, and server actions do not change.
- Video: responsive privacy-enhanced frames with explicit titles, lazy loading, source, and caption status; no autoplay and no locally hosted 100 MB master.
- Consent banner: preserve decisions and controls, but reduce visual dominance and ensure it does not conceal primary mobile actions.
- Empty/pending states: retain honest states; use a thin ruled panel, never invented reviews, awards, products, or photography.

## Route-by-route treatment

| route | proposed treatment | preserved contract |
|---|---|---|
| `/` | Airy off-white publisher hero with the transparent front/back box at editorial scale; proof becomes a ruled strip; a full-bleed cosmic Lunar feature introduces the real component art; story and real team image close in a calm magazine rhythm; newsletter is a compact final band. | Existing copy, CTA targets, catalogue substitutions, newsletter behaviour, structured data, and sections |
| `/games/lunar-base` | Full-bleed cosmic hero with Lunar wordmark, live pitch, open-box render, price/stock/Buy; launch-site-style spec strip; line-art component spread; open typographic “how it plays” and victory-path sequences; real wide table scene; purposeful trailer/tutorial pair; reviews/purchase/legal safety content remain honest and readable. | All current product copy, price/tax/shipping language, catalogue data, anchors, purchase flow, safety block, and structured data |
| `/about` | Publisher editorial page: oversized origin lede, real team photograph as the human centre, restrained timeline rule. No member cards. | Six-person account, exact story/timeline copy, no invented names or roles |
| `/support/lunar-base` | Clear service page with a compact Lunar masthead, rulebook action, single-column FAQ rhythm, tutorial, component checklist, and high-clarity contact form. | FAQ/content, runtime contact substitution/suppression, Turnstile/honeypot and form actions |
| `/support/lunar-base/rulebook` | Focused dark Lunar reading/download page with the rulebook action above the fold and a restrained product emblem/texture. | Exact 25-page/8.9 MB disclosure, tagged PDF, CSP-safe link-only delivery |
| `/cart` | Calm publisher commerce surface with a strong item/order hierarchy, fewer nested boxes, persistent readable totals, and direct continuation action. | Basket state, quantity/removal behaviour, price/tax/shipping copy, empty state, links |
| `/checkout` | Two-column publisher checkout on desktop, one column on mobile; form sections separated by rules and spacing, with a restrained sticky order summary where viewport permits. | Fields, validation, terms, order POST, runtime configuration, payment/fulfilment boundaries |
| `/legal/imprint` | Shared editorial legal template with visible title, reading-width content, anchored section rhythm, and restrained publisher masthead. | Copy and destinations verbatim |
| `/legal/privacy` | Same legal template, optimised for long-form scanning and keyboard focus. | Copy verbatim |
| `/legal/returns` | Same legal template with policy hierarchy expressed by typography, not promotional cards. | Copy verbatim |
| `/legal/shipping` | Same legal template with operational details kept prominent and unembellished. | Copy verbatim |
| `/legal/terms` | Same legal template with readable measure and strong heading hierarchy. | Copy verbatim |
| locale-prefixed equivalents | Render the identical component system and breakpoint behaviour through the existing localized route dispatcher. | Locale routing/fallback contract and content parity |
| not-found routes | Branded, compact publisher response with one clear route home; Lunar styling only when current routing already supplies it. | Status and navigation semantics |

## Responsive intent

- Desktop (1440): immersive media can bleed edge-to-edge while text remains in the 1200 px frame; the hero keeps purchase information visible without scrolling through decorative content.
- Tablet (768–1024): two-column heroes remain only while copy and art each retain usable width; grids collapse before text or controls become cramped.
- Mobile (390): art follows the core proposition, controls become full-width where useful, specs use two columns, long sections become a single reading flow, and no fixed overlay hides the Buy or submit action.
- Images use explicit dimensions, responsive sources, intentional crops, lazy loading below the fold, and transparent art only over controlled surfaces.

## Content, accessibility, and implementation boundaries

- Existing storefront copy is locked verbatim. This redesign changes presentation and approved media bindings, not marketing, legal, product, or support claims.
- Framework, routes, data sources, commerce behaviour, server actions, CSP, consent, analytics boundaries, and runtime configuration remain unchanged.
- Real imagery only. No fabricated product, components, people, reviews, awards, or campaign claims.
- Maintain one `h1`, semantic section headings, visible focus, correct landmarks, reduced-motion support, keyboard-operable disclosures/menu/forms, AA colour pairs, and descriptive alternative text based on visible evidence.
- The only known baseline anomaly is environmental: `next build` passes outside the filesystem sandbox, while the sandbox suppresses stdout from Next's detached TypeScript configuration subprocess. It is not a code change target.

## Implementation and QA record

The operator approved the reference set, asset-role map, media selection, and route treatment before implementation. The Browser plugin was not available in this environment, so rendered verification used the repository's pinned Playwright/Chromium setup instead. Every public route was inspected at 1440 and 390 px, checkout/support/Lunar Base were additionally inspected at 768 px, and the committed desktop/mobile baselines were rerun without update mode. Section baselines cover below-fold team, table, and video compositions. Browser checks also cover console and page errors, consent loading, approved privacy-enhanced video frames, mobile-menu keyboard entry/Escape/close/focus return, cart refusal states, and checkout disclosure safeguards. Source tests retain the reduced-motion, CSP, rulebook, and responsive-layout contracts.
