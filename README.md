# Plepic

The Plepic Games storefront and backend monorepo: an npm workspace root for a
Next.js storefront and, later, a Medusa backend.

## Workspaces

- `storefront/` — the Next.js App Router application shell serving the entire
  public site: host-based redirects and the test-hostname `noindex` gate
  (`src/proxy.ts`), per-route SEO metadata and the sitemap/`robots.txt`
  contract (`src/lib/seo.ts`, `src/lib/sitemap-contract.ts`), the
  consent-gated Google Analytics loader and the Cloudflare Turnstile widget,
  and the one runtime-config object every per-environment value (base URL,
  measurement ID, site key) is read into server-side and handed to the
  browser — never a `NEXT_PUBLIC_*` variable. See
  [`storefront/src/config/runtime-config.ts`](./storefront/src/config/runtime-config.ts)
  for that mechanism and [`storefront/src/config/redirect-map.ts`](./storefront/src/config/redirect-map.ts)
  for the redirect map's documented shape. Page composition, the cart, and
  checkout are later PR units.
- `backend/` — Medusa backend, added by a later PR unit.

Two directories are not workspaces but are consumed by the storefront:

- `design/` — `tokens.css` and the design system's record, including the
  measured contrast ratios and the webfont licence obligations.
  `design/tokens.test.ts` resolves the token file the way a browser does and
  holds every rendered colour pair to its WCAG minimum.
- `content/` — the site's copy as typed TypeScript, with the editorial content
  document beside it. See [`content/README.md`](./content/README.md) for why it
  is TypeScript rather than MDX, and what that makes impossible.

## Development

```bash
npm ci
bash scripts/validate
```

Dependency installation is intentionally separate from validation so repeated
validation runs do not reinstall packages. `scripts/validate` runs lint
(`eslint`, over the whole repository), a type-check (`tsc --noEmit`), and the
unit test suite (`vitest run`).

`vitest.config.ts` at the repository root is a **projects** list, not a single
`include` array, and it is the one statement of what `npm run test:unit` runs:
the `repo` project covers `content/`, `design/` and `scripts/`, and the
`storefront` project is `storefront/vitest.config.ts`, which needs different
settings because `storefront/tests/build-and-serve.test.ts` runs a real
`next build` and `next start`. That build is why validation takes about a
minute rather than a second; it is also the only way to prove that no
per-environment value was baked into the image. Adding a workspace means
adding it to that list, or its tests run in no gate.

The root `npm run typecheck` is narrower than the test run: it covers
`content/**/*.ts`, `design/**/*.ts`, `scripts/**/*.ts` and `vitest.config.ts`
— `tsconfig.json`'s `include` is scoped there deliberately, and `storefront/`
is absent on purpose, because Next.js scaffolds its own `tsconfig.json` (see
`AGENTS.md`, next to the TypeScript version pin). `storefront/` is
nevertheless type-checked by the same validation run, because the `next build`
inside `storefront/tests/build-and-serve.test.ts` runs TypeScript over
`storefront/tsconfig.json` — `src/` and `tests/` both — and fails the build,
and therefore the test, and therefore `scripts/validate`, on a type error. For
a faster loop while working inside the storefront:

```bash
cd storefront
npm run typecheck
npm run test:unit
```

## Enabling the pre-commit hook

This repository ships a `.githooks/pre-commit` hook that runs a `gitleaks`
scan over staged changes and rejects a commit that looks like it contains a
secret. Enable it once per checkout:

```bash
git config --local core.hooksPath .githooks
```

It requires `gitleaks` on `PATH` — install it from
<https://github.com/gitleaks/gitleaks/releases> or your package manager
before committing.

## Continuous integration

`.github/workflows/validate.yml` runs on every pull request and every push to
`main`: `npm ci`, `bash scripts/validate`, then a `gitleaks` scan of the full
history, using a pinned and checksum-verified `gitleaks` release. Every
GitHub Action is pinned by commit SHA, and the workflow is granted
`contents: read` only.

## Repository boundaries

No application source, Dockerfile, image build, or Kubernetes manifest lives
outside this repository — this repository's CI builds and publishes images
and writes their digests to `hannosirkel/deploys`. This repository contains no
live hostname, address, or credential; those are configuration, delivered at
runtime, never committed here.

That last sentence is a test, not a promise. `content/content.test.ts` holds
`content/` to naming no hostname at all, and
`storefront/tests/no-live-hostname.test.ts` holds `storefront/src` and
`storefront/tests` to an allowlist of RFC 2606 reserved example domains plus
the third-party endpoints the application genuinely talks to. Both scan source
text as well as exported values, because a hostname in a comment leaks exactly
as completely as one in a string — and a comment is where the last one was
found.
