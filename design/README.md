# Design system

`tokens.css` is the whole design system that exists so far. It defines three
layers, and only the middle one is allowed to appear in a component.

| Layer | Contains | Consumed by |
|---|---|---|
| 0 — brand ramps | `--plepic-*`, `--lunar-*` | layer 1 only |
| 1 — semantic tokens | `--surface`, `--text`, `--accent`, `--border`, `--focus-ring`, … | components, and layer 2 |
| 2 — component tokens | buttons, cards, navigation, purchase panel | components |

## Why a section switches by token, not by component

The site carries two visual identities: the publisher (light, off-white, navy)
and Lunar Base (dark, near-black blue). Both appear on the homepage. If those
were two sets of components, every button, card, price and focus ring would
exist twice and would drift.

Instead, layer 1 is redeclared under `[data-layer="lunar"]`, and layer 2
resolves entirely through layer 1. A section changes identity with one
attribute:

```html
<section data-layer="lunar">
  <!-- the same <Button>, the same <Card>, the same purchase panel -->
</section>
```

`[data-layer="publisher"]` is declared as well as `:root`, so a publisher-styled
block can sit inside a Lunar Base region without resetting the document.

The rule that keeps this true: **no component may reference a layer 0 token, a
literal colour, or a hex value.** If a component needs a colour that layer 1
does not offer, the fix is a new semantic token declared in both layers — not a
one-off value.

### The trap this file fell into once

Both layer blocks **and the layer-2 block** carry the full selector list:

```css
:root,
[data-layer="publisher"],
[data-layer="lunar"] { --card-bg: var(--surface-raised); … }
```

That repetition is not redundancy. A custom property is substituted at
computed-value time on the element that declares it, and inherited already
resolved. Declared only on `:root`, `--card-bg` computes once against the
publisher palette, and a `[data-layer="lunar"]` descendant inherits `#FFFFFF` —
redeclaring `--surface-raised` on the section changes nothing, because
`--card-bg` no longer refers to it.

The first revision of this file did exactly that. Cards, navigation and the
purchase panel rendered in the publisher palette inside every Lunar Base
section, and a component written as `color: var(--text)` on
`background: var(--card-bg)` came out at **1.43:1**. Nothing in the file looked
wrong.

**Adding a third layer means adding its selector to the layer-2 block too.**
`tokens.test.ts` asserts that, and reproduces the bug if the selector list is
narrowed again.

## Typeface

**MADE Evolve Sans**, five weights: thin 100, light 300, regular 400, medium
500, bold 700. The masters are OTF; the web build is woff/woff2.

It is licensed under the **Fontspring Webfont EULA 1.7.0**. The obligations that
bind this repository:

- **Ship woff and woff2 only. Never the OTFs.** The EULA (§2a) forbids linking
  to the desktop OpenType/TrueType files; those are covered by a separate
  desktop licence and must not enter the repository or an image.
- **Preserve the entire Fontspring commented header** in any stylesheet that
  declares the faces (§2b). It is the `/*! Web Fonts from Fontspring … */`
  banner shipped alongside each webfont. A CSS minifier that strips comments
  must be configured to keep `/*!` banners.
- **The licence caps total pageviews per month** at a figure recorded on the
  purchase invoice (§2c). **The invoice has not been located.** The cap is
  therefore unknown, and that is an open item, not a resolved one: before the
  site carries meaningful traffic, either find the invoice or re-license. Record
  it in the operator manifest, not here.
- **Do not modify the font files** or generate derivatives beyond what embedding
  requires (§6). No subsetting tool that rewrites glyph outlines, no
  self-generated variable-font conversion.
- The licence covers websites the licensee owns or controls (§2d). Both the
  live site and the test environment are in scope, and both are configured
  hostnames — this repository names neither.

`tokens.css` deliberately contains **no `@font-face` block and no font files.**
It names the family in `--font-sans` and nothing more. The declarations, the
woff/woff2 files and the Fontspring header land with the storefront in a later
unit, so the licensed binaries and their required header travel together.

The fallback stack is chosen to survive a failed webfont: `Avenir Next`,
`Century Gothic` and `URW Gothic` keep the geometric proportions on macOS,
Windows and Linux respectively, then `system-ui` and the usual grotesques. The
page is legible, and roughly the right shape, with no webfont at all.

## Contrast

WCAG 2.2 AA is a build requirement: 4.5:1 for normal text, 3:1 for large text
and for the boundaries of user-interface components and the focus indicator.

Every ratio below was taken from the values **headless Chromium actually
computes** for an element inside `<section data-layer="…">`, over this file —
not from reading the token graph. `tokens.test.ts` re-derives the same pairs on
every run with a resolver that models per-element custom-property substitution,
and its output was checked against that browser: all 36 pairs match exactly.

### Layer-1 text

| Foreground | Publisher | Ratio | Lunar Base | Ratio |
|---|---|---|---|---|
| `--text` on `--surface` | `#151B46` on `#F7F4EC` | 14.96 | `#D6D7E3` on `#080C23` | 13.51 |
| `--text-muted` on `--surface` | `#454B70` on `#F7F4EC` | 7.66 | `#B8BAD1` on `#080C23` | 10.10 |
| `--text-subtle` on `--surface` | `#5A6084` on `#F7F4EC` | 5.55 | `#858AA2` on `#080C23` | 5.66 |
| `--accent` on `--surface` | `#186E82` on `#F7F4EC` | 5.32 | `#25A8C5` on `#080C23` | 6.89 |
| `--text-on-surface-sunken` on `--surface-sunken` | `#F7F4EC` on `#151B46` | 14.96 | `#D6D7E3` on `#0D0D3B` | 12.91 |

### Layer-2 components, per layer

These are the pairs that were wrong before the layer-2 selector list was fixed.
The last three mix a layer-1 foreground with a layer-2 surface, which is what a
component written as `color: var(--text)` on a card actually does.

| Pair | Publisher | Ratio | Lunar Base | Ratio |
|---|---|---|---|---|
| `--card-fg` on `--card-bg` | `#151B46` on `#FFFFFF` | 16.44 | `#D6D7E3` on `#111732` | 12.32 |
| `--card-meta-color` on `--card-bg` | `#5A6084` on `#FFFFFF` | 6.10 | `#858AA2` on `#111732` | 5.16 |
| `--nav-fg` on `--nav-bg` | `#151B46` on `#F7F4EC` | 14.96 | `#D6D7E3` on `#080C23` | 13.51 |
| `--nav-fg-muted` on `--nav-bg` | `#454B70` on `#F7F4EC` | 7.66 | `#B8BAD1` on `#080C23` | 10.10 |
| `--nav-fg-active` on `--nav-bg` | `#186E82` on `#F7F4EC` | 5.32 | `#25A8C5` on `#080C23` | 6.89 |
| `--nav-fg` on `--nav-sheet-bg` | `#151B46` on `#FFFFFF` | 16.44 | `#D6D7E3` on `#111732` | 12.32 |
| `--purchase-panel-fg` on `--purchase-panel-bg` | `#151B46` on `#FFFFFF` | 16.44 | `#D6D7E3` on `#111732` | 12.32 |
| `--purchase-price-color` on `--purchase-panel-bg` | `#151B46` on `#FFFFFF` | 16.44 | `#D6D7E3` on `#111732` | 12.32 |
| `--purchase-note-color` on `--purchase-panel-bg` | `#454B70` on `#FFFFFF` | 8.42 | `#B8BAD1` on `#111732` | 9.21 |
| `--purchase-availability-color` on `--purchase-panel-bg` | `#186E82` on `#FFFFFF` | 5.85 | `#F2B63D` on `#111732` | 9.67 |
| `--text` on `--card-bg` | `#151B46` on `#FFFFFF` | 16.44 | `#D6D7E3` on `#111732` | 12.32 |
| `--text` on `--purchase-panel-bg` | `#151B46` on `#FFFFFF` | 16.44 | `#D6D7E3` on `#111732` | 12.32 |
| `--text` on `--nav-bg` | `#151B46` on `#F7F4EC` | 14.96 | `#D6D7E3` on `#080C23` | 13.51 |

### Buttons

| Pair | Publisher | Ratio | Lunar Base | Ratio |
|---|---|---|---|---|
| primary label on fill | `#151B46` on `#F06432` | 5.15 | `#151B46` on `#F06432` | 5.15 |
| primary hover | `#151B46` on `#F2B63D` | 9.03 | `#151B46` on `#F2B63D` | 9.03 |
| secondary label on `--surface` | `#151B46` on `#F7F4EC` | 14.96 | `#D6D7E3` on `#080C23` | 13.51 |
| secondary hover | `#151B46` on `#D9D4C6` | 11.11 | `#D6D7E3` on `#1B2256` | 10.42 |
| quiet label on a card | `#186E82` on `#FFFFFF` | 5.85 | `#25A8C5` on `#111732` | 6.28 |
| **disabled label on disabled fill** | `#5A6084` on `#D9D4C6` | **4.12** | `#858AA2` on `#1B2256` | **4.37** |

The primary call to action is orange with a navy label on **both** layers, so
the buy button reads the same everywhere on the site. A white or off-white
label on orange is only 3.19:1 and would fail; navy on orange passes
comfortably.

The two disabled pairs are the only ones under 4.5:1. WCAG 2.2 SC 1.4.3 exempts
text that is part of an inactive user-interface component, and a disabled
control that meets AA reads as enabled. They are listed rather than omitted so
the exemption is a decision on the record, and `tokens.test.ts` still holds them
to 3:1.

### Non-text: component boundaries and focus (3:1 required)

| Pair | Publisher | Ratio | Lunar Base | Ratio |
|---|---|---|---|---|
| `--border-interactive` on `--surface` | `#5A6084` on `#F7F4EC` | 5.55 | `#858AA2` on `#080C23` | 5.66 |
| `--border-interactive` on `--card-bg` | `#5A6084` on `#FFFFFF` | 6.10 | `#858AA2` on `#111732` | 5.16 |
| `--button-secondary-border` on `--surface` | `#151B46` on `#F7F4EC` | 14.96 | `#D6D7E3` on `#080C23` | 13.51 |
| `--focus-ring` on `--surface` | `#151B46` on `#F7F4EC` | 14.96 | `#F2B63D` on `#080C23` | 10.61 |
| `--focus-ring` on `--card-bg` | `#151B46` on `#FFFFFF` | 16.44 | `#F2B63D` on `#111732` | 9.67 |

### Deliberately restricted — these carry no text and no control edge

| Value | Against | Ratio | Role |
|---|---|---|---|
| `--plepic-cyan` `#25A8C5` | `#F7F4EC` | 2.55 | fill and graphic only on the publisher layer — this is why `--plepic-cyan-deep` exists |
| `--plepic-orange` `#F06432` | `#F7F4EC` | 2.91 | fill only; `--plepic-orange-deep` `#B0431C` (5.21) for orange text on light |
| `--plepic-gold` `#F2B63D` | `#F7F4EC` | 1.66 | fill, hover fill and selection highlight only **on the publisher layer**; it is a text colour on the Lunar Base layer, where it is 10.61 |
| `--border` `#D9D4C6` (publisher) | `#F7F4EC` | 1.35 | decorative hairline; never a control edge |
| `--border` `#2E3041` (lunar) | `#080C23` | 1.49 | decorative hairline; never a control edge |
| `--lunar-line-strong` `#585C77` | `#080C23` | 2.95 | decorative divider — **below 3:1**, so it is bound to no interactive token |
| `--lunar-accent` `#386693` | `#080C23` | 3.21 | graphic and boundary use only; it is **not** bound to `--accent`, because 3.21 fails normal text |
| `--surface-decor` `#1B2256` (lunar) | `#080C23` | 1.30 | graphic surface; `--text-subtle` on it is 4.37, so `--surface-raised` is `#111732`, not this |

The last two rows are the reason the Lunar Base layer does not simply map its
measured accent onto `--accent`. `#386693` is the game's own accent colour and
it is used — for panel edges, rules, dividers and graphic fills — but the
layer's readable accent is the publisher cyan, which passes on every Lunar
surface.

`tokens.test.ts` asserts the restriction directly: no text token on either layer
may resolve to one of these values.

### `--accent-positive`, and why availability is not gold

"In stock" is text. Binding it to `--accent-quiet` put gold on a white panel at
**1.82:1** on the publisher layer, contradicting the row above in this very
file. `--accent-positive` is the readable equivalent, declared per layer:
`#186E82` on the publisher layer (5.85 on a panel) and `#F2B63D` on the Lunar
Base layer (9.67 on a panel), where gold is genuinely readable.

### Derived colours

Five values in layer 0 are not measured from a brand source. They are derived
so that AA is reachable without improvising a colour at the call site, and they
are listed here so a reviewer can see exactly what was invented and why:

| Token | Value | Derived from | Why |
|---|---|---|---|
| `--plepic-cyan-deep` | `#186E82` | `--plepic-cyan` darkened | cyan is unreadable as text on off-white (2.55); this is 5.32 |
| `--plepic-orange-deep` | `#B0431C` | `--plepic-orange` darkened | orange is unreadable as text on off-white (2.91); this is 5.21 |
| `--plepic-navy-70` | `#454B70` | `--plepic-navy` lightened | secondary body text on light, 7.66 |
| `--plepic-navy-55` | `#5A6084` | `--plepic-navy` lightened | tertiary text and control edges on light, 5.55 |
| `--plepic-sand` | `#D9D4C6` | `--plepic-offwhite` darkened | decorative hairline on light |

### Enforcement

`design/tokens.test.ts` runs under `bash scripts/validate` and:

- parses `tokens.css`, resolves custom properties the way a browser does, and
  asserts the component layer is declared on every layer selector;
- checks all 36 foreground/background pairs above against their WCAG minimum,
  on both layers;
- rejects a literal colour in the layer-2 block;
- rejects a text token bound to any value in the restricted table;
- fails if any component token resolves to an unsubstituted `var()` on either
  layer.

Narrowing the layer-2 selector list back to `:root` reproduces nine failures,
including the three mixed pairs that fall to 1.43:1. Anyone changing a colour
updates the tables here in the same commit; the test catches it if they do not.
