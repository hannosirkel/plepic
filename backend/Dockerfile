# The Medusa backend image: API, worker, predeploy migrations and the
# catalogue-import Job all run from this one image.
#
# Build context is the **repository root**, not `backend/` — this is an npm
# workspace and the dependency tree it installs is the one `package-lock.json`
# at the root describes:
#
#     docker buildx build --file backend/Dockerfile .
#
# The ignore-file for this build is `backend/Dockerfile.dockerignore`. That
# name is not decorative: with a context of `.`, BuildKit reads
# `<dockerfile>.dockerignore` beside the Dockerfile, and would never look at a
# `.dockerignore` inside `backend/`. See `scripts/images.test.ts`.
#
# ## Nothing environment-specific is baked in
#
# There is no `ARG` in this file, and every `ENV` it sets is identical in every
# environment. The synthetic values on the `medusa build` line below exist only
# because `medusa-config.ts` reads its configuration at module scope and the
# compiler loads it; they are inline on the `RUN` instruction, so they are not
# `ENV`, do not persist into any layer, and are not what the running container
# reads. `src/config/runtime.ts` re-reads all of it from `process.env` at
# start-up, from the Secrets the `deploys` manifests project.

# node:24.18.1-trixie-slim
FROM node:24.18.1-trixie-slim@sha256:ac39e4b5fcb2b1b34b20364fd58b2e898f3bb80731ee6f62a7536f9df3d6aadc AS build

WORKDIR /src

# The manifests first, so the install layer is cached against them rather than
# against the source. All three are needed even for a single workspace: npm
# reads every workspace's `package.json` before it resolves anything.
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY storefront/package.json storefront/package.json

RUN npm ci --workspace backend --include-workspace-root

COPY backend/ backend/

# `medusa build` compiles `src/` and `medusa-config.ts` into `.medusa/server`
# and builds the Admin bundle into `.medusa/server/public`. It evaluates the
# config to do it, which is why the required variables are supplied here.
#
# Every value below is a placeholder and none of them can reach a request:
# `postgres://build:build@127.0.0.1:5432/build` points at the build container's
# own loopback, the CORS origins are RFC 2606 reserved names, and the secrets
# are the literal word `build`. `XDG_CONFIG_HOME` and `MEDUSA_DISABLE_TELEMETRY`
# keep the compiler from writing to or phoning home from a build.
RUN NODE_ENV=production \
  DATABASE_URL=postgres://build:build@127.0.0.1:5432/build \
  JWT_SECRET=build \
  COOKIE_SECRET=build \
  STORE_CORS=https://storefront.example.test \
  ADMIN_CORS=https://admin.example.test \
  AUTH_CORS=https://storefront.example.test \
  STRIPE_SECRET_KEY=build \
  STRIPE_WEBHOOK_SECRET=whsec_build \
  STRIPE_PAYMENT_METHOD_CONFIGURATION_ID=pmc_build \
  SMTP_HOST=smtp.example.test \
  SMTP_PORT=587 \
  SMTP_USERNAME=build \
  SMTP_PASSWORD=build \
  SMTP_ENVELOPE_FROM=orders@example.test \
  CONTACT_MAIL_RECIPIENT=contact@example.test \
  TURNSTILE_SECRET_KEY=build \
  MERCHANT_LEGAL_NAME='Example Games OÜ' \
  MERCHANT_REGISTERED_ADDRESS='Example Street 1, Tallinn' \
  MERCHANT_CONTACT_ADDRESS=legal@example.test \
  MERCHANT_RETURN_ADDRESS='Return Street 2, Tallinn' \
  MEDUSA_DISABLE_TELEMETRY=true \
  XDG_CONFIG_HOME=/tmp/medusa-build-config \
  npm run build --workspace backend

# The runtime dependency tree, resolved from the same lockfile with the
# development half omitted. It is installed in its own stage so that no
# compiler, no `@swc`, no `typescript` and no build cache reaches the image
# that ships.
# node:24.18.1-trixie-slim
FROM node:24.18.1-trixie-slim@sha256:ac39e4b5fcb2b1b34b20364fd58b2e898f3bb80731ee6f62a7536f9df3d6aadc AS runtime-dependencies

WORKDIR /src

COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY storefront/package.json storefront/package.json

RUN npm ci --omit=dev --workspace backend --include-workspace-root

# esbuild is deleted from the runtime tree, because it is a build tool that
# ships a compiled Go standard library and nothing in the runtime path calls
# it.
#
# It is here at all as a *production* transitive dependency, so `--omit=dev`
# does not remove it:
#
#     @medusajs/medusa -> @medusajs/admin-bundler -> vite ^5.4.21
#       -> esbuild ^0.21.3 -> @esbuild/linux-x64 (bin/esbuild, a Go binary)
#
# The whole package goes, not just the `@esbuild/*` platform package, because
# there are **two** copies of that one binary: esbuild's `install.js` copies
# the platform binary over its own `bin/esbuild` shim on install, so the tree
# carries it at both `@esbuild/linux-x64/bin/esbuild` and
# `@medusajs/admin-bundler/node_modules/esbuild/bin/esbuild`. Trivy reports
# one finding for the two identical files, so removing only the first moves
# the finding rather than clearing it.
#
# `@medusajs/admin-bundler` exports four entry points. Three of them —
# `build`, `develop` and `plugin` — `await import("vite")`, and all three are
# build-time commands that run in the `build` stage above, never here. The
# fourth, `serve`, is the only one `medusa start` reaches: the framework's
# admin loader calls it for every non-development `NODE_ENV`, and it is
# `compression`, `express`, `fs` and `path` serving the pre-built bundle out
# of `.medusa/server/public`. Because the vite imports are dynamic and inside
# those three functions, loading `@medusajs/admin-bundler` does not load vite,
# and nothing loads esbuild.
#
# Deleting it rather than overriding the version is deliberate. vite 5.4.21
# accepts `esbuild@^0.21.3`, and the newest release in that range, 0.21.5, is
# the one already here — built against Go 1.20.12, which is what the scanner
# reports. Only much later esbuild minors carry a patched Go, and forcing one
# past vite's range would change the compiler that `medusa build` runs with in
# the stage above, to fix a binary that never executes in the stage below.
#
# The two halves below are a removal and an assertion, and they are separate on
# purpose, because a removal by name can only ever delete what it was told to
# look for.
#
# The `find … -exec rm -rf` is the removal. It matches on names, and it is
# allowed to match nothing: a future dependency tree that has dropped esbuild
# is a clean tree, not a build failure, so this must not insist the package was
# there.
#
# The `test -z` is the assertion, and it is what the removal is actually held
# to. It looks for what the *scanner* looks for rather than for a name:
# `Go buildinf:` is the ASCII part of the build-information magic that Go
# stamps into every binary it links, and it is what Trivy's `gobinary` analyzer
# reads to decide a file is one. Keying on the same marker is what makes this
# as strong as the gate rather than a second guess at it — whatever this misses
# the scanner misses too — and it fails the build on any Go binary left in the
# tree that ships, under whatever package or file name it arrived.
#
# `-a` is load-bearing rather than tidiness. Without it, whether a binary file
# can match at all is left to the grep implementation's own heuristics: GNU grep
# reports a match here, but an implementation that treats binary files as
# non-matching reports nothing, and this check would then pass while the binary
# ships. That is failing **open**, the one direction a guard must not fail. `-a`
# says to treat every file as text and takes the decision away from the
# implementation.
#
# Cost is bounded by the filter rather than by the tree: of roughly 92,000 files
# here, `-perm -u+x -o -size +1M` selects under 200 and the scan takes about
# 0.4 s. Measured in this stage and after the removal above, which is the tree
# this `find` actually walks.
#
# So a dependency tree that *moves* the binary fails here, loudly, at build
# time; a dependency tree that *drops* it passes. `scripts/images.test.ts`
# holds this file to carrying both halves.
RUN find . -depth \( -name esbuild -o -name '@esbuild' \) -exec rm -rf {} + \
  && test -z "$(find . -type f \( -perm -u+x -o -size +1M \) \
       -exec grep -la 'Go buildinf:' {} + 2>/dev/null)"

# node:24.18.1-trixie-slim
FROM node:24.18.1-trixie-slim@sha256:ac39e4b5fcb2b1b34b20364fd58b2e898f3bb80731ee6f62a7536f9df3d6aadc AS runtime

# `org.opencontainers.image.source` is deliberately **not** here, and it is
# not omitted either: `release.yml` and `deploy-test.yml` each pass it to both
# builds as a `--label` on their one `docker buildx build`. It belongs
# there rather than in a Dockerfile because the storefront image cannot carry
# it in *its* Dockerfile — `storefront/tests/no-live-hostname.test.ts` scans
# every tracked file under `storefront/`, that Dockerfile included, and the
# forge hostname is not on its allowlist — so setting it in one place per
# workflow keeps the two images labelled identically. The label matters: it
# is how GitHub links a container package to a repository, and a linked
# package inherits that repository's access rather than being private and
# unreachable. `scripts/workflows.test.ts` asserts the flag and its value in
# both workflows.
LABEL org.opencontainers.image.description="Plepic Games Medusa backend"
LABEL org.opencontainers.image.licenses=UNLICENSED

ENV NODE_ENV=production
# `medusa start` runs under `npm run`, and npm wants somewhere to put a cache
# and a crash log. The `deploys` manifests give this container a read-only root
# filesystem with exactly two writable paths, `/tmp` and the assets PVC, so npm
# is pointed at the first of them rather than at a `$HOME` it cannot create.
ENV HOME=/tmp
ENV npm_config_cache=/tmp/.npm
ENV npm_config_update_notifier=false
ENV MEDUSA_DISABLE_TELEMETRY=true
# The same `NODE_PATH` the `build` script in `backend/package.json` sets, for
# the same reason, and it is load-bearing rather than defensive.
#
# `npm ci` resolves this workspace to two levels: most of `@medusajs/*` hoists
# to the workspace root, while `@medusajs/medusa`, `@medusajs/draft-order` and
# `@medusajs/ui` nest under `backend/`, because their transitive versions
# conflict with what hoisting pulled up. Those two levels are reproduced below
# as `/node_modules` and `/app/node_modules`. Ordinary resolution covers one
# direction — code under `/app/node_modules` walks up to `/node_modules` — and
# cannot cover the other: `@medusajs/utils`, hoisted to `/node_modules`, does a
# runtime `require("@medusajs/medusa/link-modules")`, and `/app` is not on its
# path. Without this line `medusa db:migrate` fails with `Cannot find module`,
# which means the predeploy Job never migrates and no pod ever serves.
ENV NODE_PATH=/app/node_modules

# npm is upgraded, in the image that ships, because it is this image's
# entrypoint and it carries its own vendored dependency tree.
#
# `hannosirkel/deploys` runs all four of this image's roles with
# `args: [npm, run, <script>]`, so npm cannot be removed here the way it is
# from the storefront image. That leaves its vendored copy of `tar` in the
# scan: the base image's npm 11.16.0 vendors `tar` 7.5.15 at
# `/usr/local/lib/node_modules/npm/node_modules/tar`, which the Trivy gate in
# `release.yml` fails on. It reaches the image through the base image and not
# through `package-lock.json` — `npm ls tar` in this repository is empty — so
# no `overrides` entry in any `package.json` here can touch it.
#
# 11.19.0 is the newest npm 11. 11.18.0 is where the vendored `tar` was first
# fixed to 7.5.19 and would clear the finding too; the newest of the major is
# taken because it also carries everything fixed between the two, and the major
# is deliberately unchanged from the 11.16.0 the base image ships, so `npm run`
# behaves exactly as it did.
#
# Upgrading npm in place is the smallest lever available: no Node release on
# the 24 LTS line ships a fixed npm — 24.19.0, the newest, is still on 11.17.0,
# whose vendored `tar` is 7.5.16 — so the alternative is moving both images off
# LTS onto the Node 26 current line to change a package manager's vendored
# library.
#
# Pinned exactly, never a range: a floating package manager would make two
# builds of one source revision differ, which is the property the whole
# rebuild-live-from-source argument rests on.
# `scripts/images.test.ts` refuses any `npm install` in either Dockerfile that
# is not exactly this shape, so the one instruction in this repository that is
# not `npm ci` cannot quietly become a dependency install.
#
# The cache goes in the same layer that creates it. `npm_config_cache` above
# points npm at `/tmp/.npm`, which is right at run time and wrong here: a
# global install leaves 30 MB of cache and a Node compile cache in the layer
# that ships, and the `deploys` manifests then mount an `emptyDir` over `/tmp`
# and hide it. Dead weight that nothing can even read.
RUN npm install --global npm@11.19.0 \
  && rm -rf /tmp/.npm /tmp/node-compile-cache

# corepack and yarn go, and only npm stays.
#
# npm stays because it is this image's entrypoint. corepack and yarn are not:
# nothing in either workspace, in `compose.yaml`, in the `deploys` manifests or
# in the Medusa runtime path invokes them, and the four things this image can be
# asked to do are all `npm run <script>`.
#
# They go for the reason the storefront image gives at greater length. Each
# carries a vendored dependency tree that `package-lock.json` does not describe
# and no `overrides` entry here governs, which is exactly the shape of the
# finding that stopped the last promotion — npm's own vendored `tar`. Neither
# produces a finding today. The point is that the next one either does not
# arrive or arrives in the one package manager this image cannot remove,
# instead of in one it never had a use for. yarn 1.22.22 is unmaintained.
#
# `command -v npm` at the end is not decoration either: it is the difference
# between this instruction and the storefront's, asserted rather than described,
# so a removal that took npm with it fails here rather than in a crash-looping
# Deployment whose `args: [npm, run, start]` no longer resolve.
RUN test -x /usr/local/bin/corepack \
  && rm -rf /usr/local/lib/node_modules/corepack /usr/local/bin/corepack \
    /opt/yarn-v* /usr/local/bin/yarn /usr/local/bin/yarnpkg \
  && ! command -v corepack && ! command -v yarn && ! command -v yarnpkg \
  && command -v npm && command -v node

# UID and GID 10001, matching `runAsUser`/`runAsGroup`/`fsGroup` on every
# workload in `hannosirkel/deploys` that runs this image. The manifests already
# refuse to start it as root (`runAsNonRoot: true`); this makes the image
# refuse on its own, so `docker run` and `compose.yaml` behave the same way.
RUN groupadd --gid 10001 plepic \
  && useradd --uid 10001 --gid 10001 --home-dir /nonexistent --no-create-home plepic

# The workspace root's hoisted tree at `/`, the backend's own nested tree at
# `/app/node_modules`. That is not a quirk: it is exactly the two-level layout
# `npm ci` produced above, reproduced with `/` standing in for the repository
# root and `/app` for the `backend` workspace, so every `require` resolves to
# the version the lockfile pinned rather than to whichever copy hoisting
# happened to leave on top.
COPY --from=runtime-dependencies /src/node_modules /node_modules

# **`/app`, and a test asserts it.**
#
# The catalogue import derives its media root from Medusa's own base directory
# — the framework's `<base>/static` — rather than from a variable, so that the
# import writes exactly where Medusa serves. The `deploys` manifests mount the
# assets PVC at `/app/static` with `subPath: media`. Those two facts only meet
# if the working directory is `/app`. A base image that moved it would leave
# imported media on the container's own filesystem, served from a path no
# volume backs, and nothing in CI would notice.
WORKDIR /app

COPY --from=runtime-dependencies /src/backend/node_modules ./node_modules
COPY --from=build /src/backend/.medusa/server ./

# The mount point for the assets PVC, created here so that a `docker run` or a
# `compose.yaml` run without a volume still has somewhere to serve `/static/*`
# from, and so that the directory is owned by the user that writes it.
RUN mkdir -p /app/static && chown 10001:10001 /app/static

USER 10001:10001

EXPOSE 9000

# The `deploys` manifests select what this image does with `args:` —
# `[npm, run, start]` for the API, `[npm, run, "start:worker"]` for the worker,
# `[npm, run, predeploy]` for the migration Job and
# `[npm, run, "catalogue:import"]` for the import Job. Kubernetes `args`
# replaces `CMD` and leaves `ENTRYPOINT` **prefixed**, so an entrypoint would
# turn every one of those into an argument list for something else.
#
# The `node` base image ships `ENTRYPOINT ["docker-entrypoint.sh"]`, a wrapper
# that prepends `node` when its first argument looks like a flag rather than a
# command. It is cleared rather than tolerated: the manifests in another
# repository say what this container runs, and what they say should be the
# whole of it.
ENTRYPOINT []
CMD ["npm", "run", "start"]
