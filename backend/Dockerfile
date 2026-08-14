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
