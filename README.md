# Plepic

The Plepic Games storefront and backend monorepo: an npm workspace root for a
Next.js storefront and, later, a Medusa backend.

## Workspaces

- `storefront/` — Next.js storefront serving the entire public site. Currently
  a placeholder workspace (a minimal `package.json` only); a later PR unit
  builds the application.
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

The type-check covers `content/**/*.ts`, `design/**/*.ts`, `scripts/**/*.ts`
and `vitest.config.ts` today — `tsconfig.json`'s `include` is scoped there
deliberately, and `storefront/` is absent on purpose, because Next.js
scaffolds its own `tsconfig.json` and the storefront workspace will realistically
get its own project reference rather than being folded into this one. A type
error inside `storefront/` will not fail `npm run typecheck` until that
workspace wires up its own type-check (see `AGENTS.md` for the same note next
to the TypeScript version pin).

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
