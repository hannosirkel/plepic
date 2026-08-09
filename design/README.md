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

Ratios below were computed from the token values with the WCAG 2.x relative
luminance formula. **Every pair intended for text meets AA**; the pairs that do
not are listed separately and are restricted to non-text roles by the token
names they are bound to.

### Publisher layer — text

| Foreground | Background | Ratio |
|---|---|---|
| `--text` `#151B46` | `--surface` `#F7F4EC` | 14.96 |
| `--text-muted` `#454B70` | `--surface` `#F7F4EC` | 7.66 |
| `--text-subtle` `#5A6084` | `--surface` `#F7F4EC` | 5.55 |
| `--text` `#151B46` | `--surface-raised` `#FFFFFF` | 16.44 |
| `--text-muted` `#454B70` | `--surface-raised` `#FFFFFF` | 8.42 |
| `--text-subtle` `#5A6084` | `--surface-raised` `#FFFFFF` | 6.10 |
| `--accent` `#186E82` | `--surface` `#F7F4EC` | 5.32 |
| `--accent` `#186E82` | `--surface-raised` `#FFFFFF` | 5.85 |
| `--text-on-surface-sunken` `#F7F4EC` | `--surface-sunken` `#151B46` | 14.96 |

### Lunar Base layer — text

| Foreground | Background | Ratio |
|---|---|---|
| `--text` `#D6D7E3` | `--surface` `#080C23` | 13.51 |
| `--text-muted` `#B8BAD1` | `--surface` `#080C23` | 10.10 |
| `--text-subtle` `#858AA2` | `--surface` `#080C23` | 5.66 |
| `--text` `#D6D7E3` | `--surface-raised` `#111732` | 12.32 |
| `--text-muted` `#B8BAD1` | `--surface-raised` `#111732` | 9.21 |
| `--text-subtle` `#858AA2` | `--surface-raised` `#111732` | 5.16 |
| `--text` `#D6D7E3` | `--surface-sunken` `#0D0D3B` | 12.91 |
| `--text-muted` `#B8BAD1` | `--surface-sunken` `#0D0D3B` | 9.65 |
| `--text-subtle` `#858AA2` | `--surface-sunken` `#0D0D3B` | 5.41 |
| `--accent` `#25A8C5` | `--surface` `#080C23` | 6.89 |
| `--accent` `#25A8C5` | `--surface-raised` `#111732` | 6.28 |
| `--accent` `#25A8C5` | `--surface-sunken` `#0D0D3B` | 6.58 |
| `--accent-hover` `#F2B63D` | `--surface` `#080C23` | 10.61 |
| `--accent-hover` `#F2B63D` | `--surface-sunken` `#0D0D3B` | 10.14 |

### Buttons — identical on both layers

| Foreground | Background | Ratio |
|---|---|---|
| `--button-primary-fg` `#151B46` | `--button-primary-bg` `#F06432` | 5.15 |
| `--button-primary-fg-hover` `#151B46` | `--button-primary-bg-hover` `#F2B63D` | 9.03 |

The primary call to action is orange with a navy label on **both** layers, so
the buy button reads the same everywhere on the site. A white or off-white
label on orange is only 3.19:1 and would fail; navy on orange passes
comfortably.

### Non-text: component boundaries and focus (3:1 required)

| Token | Against | Ratio |
|---|---|---|
| `--border-interactive` `#5A6084` (publisher) | `--surface` `#F7F4EC` | 5.55 |
| `--border-strong` `#151B46` (publisher) | `--surface` `#F7F4EC` | 14.96 |
| `--focus-ring` `#151B46` (publisher) | `--surface` `#F7F4EC` | 14.96 |
| `--focus-ring` `#151B46` (publisher) | `--surface-raised` `#FFFFFF` | 16.44 |
| `--border-interactive` `#858AA2` (lunar) | `--surface` `#080C23` | 5.66 |
| `--border-interactive` `#858AA2` (lunar) | `--surface-raised` `#111732` | 5.16 |
| `--focus-ring` `#F2B63D` (lunar) | `--surface` `#080C23` | 10.61 |

### Deliberately restricted — these carry no text and no control edge

| Value | Against | Ratio | Role |
|---|---|---|---|
| `--plepic-cyan` `#25A8C5` | `#F7F4EC` | 2.55 | fill and graphic only on the publisher layer — this is why `--plepic-cyan-deep` exists |
| `--plepic-orange` `#F06432` | `#F7F4EC` | 2.91 | fill only; `--plepic-orange-deep` `#B0431C` (5.21) for orange text on light |
| `--plepic-gold` `#F2B63D` | `#F7F4EC` | 1.66 | fill and selection highlight only |
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

### Derived colours

Four values in layer 0 are not measured from a brand source. They are derived
so that AA is reachable without improvising a colour at the call site, and they
are listed here so a reviewer can see exactly what was invented and why:

| Token | Value | Derived from | Why |
|---|---|---|---|
| `--plepic-cyan-deep` | `#186E82` | `--plepic-cyan` darkened | cyan is unreadable as text on off-white (2.55); this is 5.32 |
| `--plepic-orange-deep` | `#B0431C` | `--plepic-orange` darkened | orange is unreadable as text on off-white (2.91); this is 5.21 |
| `--plepic-navy-70` | `#454B70` | `--plepic-navy` lightened | secondary body text on light, 7.66 |
| `--plepic-navy-55` | `#5A6084` | `--plepic-navy` lightened | tertiary text and control edges on light, 5.55 |
| `--plepic-sand` | `#D9D4C6` | `--plepic-offwhite` darkened | decorative hairline on light |

### Not yet automated

These ratios are recorded, not enforced. The storefront unit that first imports
`tokens.css` should add a test that parses this file and re-derives the table,
so an edited token cannot silently fail AA. Until then, anyone changing a
colour here updates this table by hand and says so in the commit.
