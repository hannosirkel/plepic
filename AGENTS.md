# Plepic Agent Instructions

<!-- BEGIN MANAGED ARCHITECTURE BASELINE -->
<!-- Generated from hannosirkel/architecture. Do not edit inside these markers.
     Regenerate with: tooling/universe sync-baseline plepic -->

Governed by [`architecture`](https://github.com/hannosirkel/architecture).

| | |
| --- | --- |
| Profile | `application-public` |
| Visibility | declared public, currently public |
| Languages | typescript, shell |

**Standards that apply here.** Read a standard before you change something it
governs.

- [Agent operation](https://github.com/hannosirkel/architecture/blob/main/standards/agent-operation.md) — worktrees, branches, multi-agent safety, delegation
- [Security](https://github.com/hannosirkel/architecture/blob/main/standards/security.md) — secrets, public and private boundaries, workflow hardening
- [Code quality](https://github.com/hannosirkel/architecture/blob/main/standards/code-quality.md) — gates, coaching, testing, review cutoff
- [Repository contract](https://github.com/hannosirkel/architecture/blob/main/standards/repository-contract.md) — required files, profiles, skills
- [Work routing](https://github.com/hannosirkel/architecture/blob/main/standards/work-routing.md) — where a change starts, and where a working plan belongs
- [Planning](https://github.com/hannosirkel/architecture/blob/main/standards/planning.md) — how a plan row is sized, the pull-request size gate
- [GitOps and deployment](https://github.com/hannosirkel/architecture/blob/main/standards/gitops-and-deployment.md) — promotion by digest, rollback, the sanctioned secrets path
- Language standards: [typescript](https://github.com/hannosirkel/architecture/blob/main/standards/languages/typescript.md), [shell](https://github.com/hannosirkel/architecture/blob/main/standards/languages/shell.md)

**Never commit to a default branch.** Work in `~/app/.worktrees/plepic/<task>`.
Branch from `origin/main`. Open a pull request.

**A working plan for this repository goes in `docs/working/`.** A change
spanning several repositories with no clear owner starts in `architecture`
instead.

**This repository must be safe to publish.** Never commit a password, token, key, kubeconfig,
rendered Secret, or live export. No repository in this universe holds a secret
value, and a private one is no exception.

**Run `habit-hooks` before declaring an edit done.** If it is not on `PATH`:

```bash
uv tool install "habit-hooks[python,typescript]"
```

That command names every language plugin **this universe** uses, not this
repository's. Install it whole: a later install naming fewer extras silently
removes the rest.

<!-- END MANAGED ARCHITECTURE BASELINE -->

## Commands

```bash
npm ci
bash scripts/validate
```

Install dependencies separately from validation. Run `bash scripts/validate`
before handoff.

## Workflow

A fresh checkout does not carry the secret scan. Enable the tracked
`.githooks/pre-commit` gitleaks hook once per checkout:

```bash
git config --local core.hooksPath .githooks
```

Do not replace it with an undocumented local Git configuration, and never bypass
it. See [`README.md`](./README.md).

## Toolchain

The root `typescript` devDependency is pinned to `^5.9.3`, not the newer `^7.x`
line Servitium uses. `typescript-eslint` declares
`peerDependencies.typescript: ">=4.8.4 <6.1.0"`, and no published
`typescript-eslint` release accepts TypeScript 7 yet. Servitium gets away with
`^7.0.2` only because it has no ESLint config at all. Bumping this repository's
root `typescript` to match Servitium's version will break `npm run lint` with a
peer-dependency error until `typescript-eslint` catches up — check its
supported range before bumping. This pin is scoped to the root tooling only;
the storefront workspace chooses its own TypeScript version when it lands (see
`README.md` for why its type-check is not yet covered by the root
`tsconfig.json`).

## Architecture

`plepic` is an npm workspace root. Both workspaces are built and both ship.

| Path | Holds |
| --- | --- |
| `storefront/` | workspace: the Next.js App Router site — routes under `src/app/(site)/`, the localized catch-all under `src/app/[locale]/`, and the same-origin `/store-api` proxy |
| `backend/` | workspace: the Medusa v2 backend — Store API routes, commerce configuration and seeding, catalogue import, the Stripe payment session, the SMTP notification provider, and the Redis preflight |
| `content/`, `design/`, `scripts/` | not workspaces: typed site copy, `tokens.css`, and the tooling `scripts/validate` runs |

`compose.yaml` stands the whole stack up locally. See [`README.md`](./README.md).
Current-state documents live in [`docs/current/`](./docs/current/).

Kubernetes manifests for both environments live in `hannosirkel/deploys` under
`plepic/`; the Argo CD `Application` objects live in `hannosirkel/orange`. This
repository's CI builds the images and writes their digests into those overlays.

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

`scripts/validate` is pure: no Docker daemon, no database, no network. Two
checks therefore sit outside it and run in CI — the browser suite
(`npm -w storefront exec -- playwright test`) and the store smoke check
(`bash scripts/store-smoke`), which needs a running Medusa.
