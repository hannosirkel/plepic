# Plepic Agent Instructions

This file guides coding agents working in this repository.

## Commands

```bash
npm ci
bash scripts/validate
```

Install dependencies separately, run focused checks while developing, then use
the canonical validation command before handoff.

## Workflow

- Inspect Git status and the relevant workspace before making changes.
- Develop on a feature branch from current `main`.
- Keep the tracked `.githooks/pre-commit` gitleaks scan enabled: run
  `git config --local core.hooksPath .githooks` once per checkout (see
  [`README.md`](./README.md)). Do not replace it with an undocumented local
  Git configuration.
- Review the complete diff and outgoing history before push. Never bypass the
  pre-commit secret scan.

## Architecture

`plepic` is an npm workspace root for the Plepic Games storefront:

- `storefront/` — Next.js App Router application serving the entire public
  site. Currently a placeholder workspace; a later PR unit builds it.
- `backend/` — Medusa backend workspace, added by a later PR unit. Not yet
  present.
- `scripts/` — repository tooling exercised by `scripts/validate` (lint,
  type-check, unit tests).

No application source, Dockerfile, or Kubernetes manifest lives outside this
repository. Kubernetes manifests for both environments live in
`hannosirkel/deploys` under `plepic/`; the Argo CD `Application` objects that
point at them live in `hannosirkel/orange`. This repository's CI owns image
promotion to those overlays.

## Security and scope

- Never commit credentials, tokens, private keys, rendered Secrets, live
  hostnames, or any other per-environment value. This repository is public.
- Nothing that differs between the live and test environments is ever baked
  into a built artifact. Next.js inlines every `NEXT_PUBLIC_*` value at build
  time, so none of them carry a per-environment value (Stripe publishable key,
  base URL, analytics measurement ID, Turnstile site key, ...); such values are
  read server-side at runtime and handed to the browser as one serialized
  runtime-config object.
- Do not add a page builder, a further component library, or a headless CMS.
- Never publish fabricated product photography, components, team portraits,
  reviews, or awards.

## Testing

Every change needs `npm ci && bash scripts/validate` passing before handoff.
Add a focused test for new logic in the same commit; a documentation-only
change needs no new test.

## Review cutoff

Must fix: contradictions between documentation and code, a validation script
that fails or that passes without checking anything real, and any credential
or per-environment value committed to the repository. Avoid historical
narration and stylistic expansion that adds maintenance cost without
preserving a decision.
