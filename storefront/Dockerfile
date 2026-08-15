# The Next.js storefront image. It serves the entire public site: marketing,
# support, legal, the basket, the checkout, and the `/store-api` prefix
# allowlist in front of the backend.
#
# Build context is the **repository root**, not `storefront/` — the application
# imports `content/` and `design/` by relative path, and its dependency tree
# comes from the workspace lockfile at the root:
#
#     docker buildx build --file storefront/Dockerfile .
#
# The ignore-file for this build is `storefront/Dockerfile.dockerignore`; with
# a context of `.`, BuildKit reads `<dockerfile>.dockerignore` beside the
# Dockerfile and would never look at a `.dockerignore` inside `storefront/`.
# See `scripts/images.test.ts`.
#
# ## Nothing environment-specific is baked in, and this is where that is won
#
# Next.js inlines every `NEXT_PUBLIC_*` value into the client bundle at build
# time. So this file declares **no `ARG` at all**: there is no build argument
# to pass a publishable key, a base URL, a measurement ID or a site key
# through, and the only `ENV` instructions it carries are `NODE_ENV`, the port
# and the bind address, which are identical in every environment.
#
# `storefront/tests/no-next-public-env.test.ts` holds the source to the same
# rule, `storefront/tests/build-and-serve.test.ts` builds the application with
# a unique canary value for every declared variable and greps the output for
# each one, and `scripts/images.test.ts` holds this file to declaring no build
# argument. The storefront reads all of it from `process.env` per request.

# node:24.18.1-trixie-slim
FROM node:24.18.1-trixie-slim@sha256:ac39e4b5fcb2b1b34b20364fd58b2e898f3bb80731ee6f62a7536f9df3d6aadc AS build

WORKDIR /src

# The manifests first, so the install layer is cached against them rather than
# against the source. All three are needed even for a single workspace: npm
# reads every workspace's `package.json` before it resolves anything.
COPY package.json package-lock.json ./
COPY storefront/package.json storefront/package.json
COPY backend/package.json backend/package.json

RUN npm ci --workspace storefront --include-workspace-root

COPY content/ content/
COPY design/ design/
COPY storefront/ storefront/

# `output: "standalone"` in `next.config.ts` makes this emit a server plus the
# exact subset of `node_modules` file tracing proved it needs. No other
# variable is set: a value that is not present at build time cannot be inlined
# by a build.
RUN NODE_ENV=production npm run build --workspace storefront

# node:24.18.1-trixie-slim
FROM node:24.18.1-trixie-slim@sha256:ac39e4b5fcb2b1b34b20364fd58b2e898f3bb80731ee6f62a7536f9df3d6aadc AS runtime

# `org.opencontainers.image.source` is not set here, and it is not omitted
# either: `release.yml` and `deploy-test.yml` each pass it to both builds as a
# `--label` on their one `docker buildx build`. This file *cannot*
# carry it — `storefront/tests/no-live-hostname.test.ts` scans every tracked
# file under `storefront/`, this Dockerfile included, and the forge is not on
# its allowlist — and widening a publication guard to carry a label would be a
# poor trade. The label is worth having: it is how the forge links a container
# package to a repository, and a linked package inherits that repository's
# access rather than being private and unreachable by the cluster.
# `scripts/workflows.test.ts` asserts the flag and its value in both workflows.
LABEL org.opencontainers.image.description="Plepic Games storefront"
LABEL org.opencontainers.image.licenses=UNLICENSED

ENV NODE_ENV=production
ENV PORT=3000
# Next's standalone server binds `0.0.0.0` by default; saying so here keeps a
# base-image change that alters that default from making the container
# unreachable to its readiness probe.
ENV HOSTNAME=0.0.0.0

# UID and GID 10001, matching `runAsUser`/`runAsGroup` on the storefront
# Deployment in `hannosirkel/deploys`. The manifest already refuses to start it
# as root (`runAsNonRoot: true`); this makes the image refuse on its own, so
# `docker run` and `compose.yaml` behave the same way.
RUN groupadd --gid 10001 plepic \
  && useradd --uid 10001 --gid 10001 --home-dir /nonexistent --no-create-home plepic

# The traced tree sits at the workspace root in the standalone output, and is
# placed at `/` here for the same reason the backend image does it: `/` stands
# in for the repository root and `/app` for the workspace, so resolution from
# the server is the resolution the build traced.
COPY --from=build /src/storefront/.next/standalone/node_modules /node_modules

# `/app`, because the storefront Deployment mounts an `emptyDir` at
# `/app/.next/cache` — the one directory a read-only root filesystem has to
# leave writable for the incremental cache.
WORKDIR /app

COPY --from=build /src/storefront/.next/standalone/storefront ./
# Neither of these is traced into the standalone output; Next expects them to
# be placed beside the server.
COPY --from=build /src/storefront/.next/static ./.next/static
COPY --from=build /src/storefront/public ./public

RUN mkdir -p /app/.next/cache && chown 10001:10001 /app/.next/cache

# npm is removed from the image that ships, because this image never runs it.
#
# The command below is `node server.js`, and the storefront container in
# `hannosirkel/deploys` declares neither `command:` nor `args:`, so that is the
# whole of what this image executes. Everything npm was needed for happened in
# the build stage above, which is a different image.
#
# It is removed rather than upgraded because it is not needed at all, and what
# is not in the image cannot be a finding. The base image's npm vendors its own
# dependency tree — `tar` 7.5.15 at the moment, which the Trivy gate in
# `release.yml` fails on — and that tree is not described by
# `package-lock.json`, so no `overrides` entry in any `package.json` here
# governs its version. Deleting the package manager from a runtime image
# retires that whole class of finding rather than chasing each instance of it.
# It does not make the image smaller — the layer below still carries the files
# and this one only records their removal — but it does take a package manager
# out of the filesystem a running container has, which is worth having on its
# own.
#
# The `test` before the removal and the `!` after it are what keep this honest
# across a base image change: the build fails if npm was not where this expects
# it, and fails if it survived the removal.
RUN test -x /usr/local/bin/npm \
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx \
  && ! command -v npm

USER 10001:10001

EXPOSE 3000

# Cleared for the same reason as in the backend image: the `deploys` manifests
# express what a container runs with `args:`, which replaces `CMD` and leaves
# an `ENTRYPOINT` prefixed — and the `node` base image ships one.
ENTRYPOINT []
CMD ["node", "server.js"]
