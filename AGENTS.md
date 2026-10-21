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
| `storefront/` | workspace: the Next.js App Router site — the default edition's routes under `src/app/(site)/`, the catch-all under `src/app/[locale]/` that serves the `/de`, `/et` and `/tlh` editions, the same-origin `/store-api` proxy, and the seven rulebook PDFs under `public/documents/` |
| `backend/` | workspace: the Medusa v2 backend — Store API routes, commerce configuration and seeding, catalogue import, the Stripe payment session, the SMTP notification provider, and the Redis preflight. It knows no edition: its e-mails are English |
| `content/` | not a workspace: typed site copy. The English modules, their mirrors in `de/`, `et/` and `tlh/`, the legal pages per edition, the locale registries, and the glossary |
| `rulebook/` | not a workspace: the build and the layout check of the translated rulebook PDFs, the frame map read from the English PDF, the text of each edition, and `manifest.json` |
| `design/`, `scripts/` | not workspaces: `tokens.css`, and the tooling `scripts/validate` runs, the Klingon word check among it |

`compose.yaml` stands the whole stack up locally. See [`README.md`](./README.md).

The site is published in four editions: English, German, Estonian and
Klingon. The URL path prefix selects the edition, and nothing negotiates one.
Read the document before you change what it describes.

| Document | Describes |
| --- | --- |
| [`docs/current/locales.md`](./docs/current/locales.md) | The editions, how one is chosen, the selector, where copy lives, how to add a string or a language |
| [`docs/current/rulebook.md`](./docs/current/rulebook.md) | The seven rulebook PDFs: sources, prerequisites, build and check commands, the manifest |
| [`docs/current/preview.md`](./docs/current/preview.md) | The pull request preview on GitHub Pages: the label, who can trigger it, what the snapshot is |
| [`docs/current/translation/`](./docs/current/translation/) | The conventions of German, Estonian, Klingon, French, Spanish and Italian copy |
| [`docs/decisions/`](./docs/decisions/) | Why the locale is chosen by the URL, how a translated rulebook PDF is produced, and why French, Spanish and Italian are rulebook languages and not editions |
| [`docs/issues/`](./docs/issues/) | What is open: known gaps, and questions the operator has not answered |

A reader-facing string is never written inside a component. It goes in
`content/`, in every edition.

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
