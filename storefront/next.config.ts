import type { NextConfig } from "next";

/**
 * Deliberately empty of anything environment-specific.
 *
 * Nothing that differs between the live and test environments belongs in this
 * file or anywhere `next build` can see it: no base URL, no hostname, no
 * publishable key, no measurement ID, no site key. Those are all read
 * server-side, at request time, from `process.env` inside route and layout
 * code (see `src/config/runtime-config.ts`) — never through `env`/`publicEnv`
 * config here and never through a `NEXT_PUBLIC_*` variable, both of which
 * Next.js inlines into the client bundle at build time.
 */
const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  /**
   * The deployable form of this application is `.next/standalone`: a server
   * and the exact subset of `node_modules` file tracing proved it needs, which
   * is what `storefront/Dockerfile` copies into the runtime image.
   *
   * This is a statement about the *shape* of the output, not a value in it. It
   * says how the build is arranged and nothing about which environment will
   * run it; every per-environment value is still read from `process.env` at
   * request time, and `tests/build-and-serve.test.ts` keeps proving that
   * against the built artifact.
   *
   * File tracing is deliberately left to infer its root. This is an npm
   * workspace with exactly one lockfile, at the repository root, so Next.js
   * roots the trace there — which is what puts the relative imports from
   * `../content` and `../design` into the standalone output at all. Naming the
   * root here would only be a second place for that to be stated, and a second
   * place for it to be stated wrongly.
   */
  output: "standalone",
  /**
   * `content/` and `design/` (outside this workspace, consumed by relative
   * import per README.md) write their own internal imports with an explicit
   * `.js` extension pointing at a `.ts` file — the Node ESM / TypeScript
   * NodeNext convention, which `content/README.md` and its `tsconfig.json`
   * predate this unit and are not this unit's to change. `tsconfig.json`
   * here stays on `moduleResolution: "bundler"`, matching Next.js's own
   * template (switching it to `nodenext` breaks type resolution for
   * `next/server`, `next/headers` and `next/script`), so the build runs on
   * Webpack (`next build --webpack` / `next dev --webpack`, see
   * `package.json`) rather than Turbopack, specifically so
   * `resolve.extensionAlias` below can be set: Turbopack has no equivalent
   * knob that is not itself gated behind `moduleResolution: "nodenext"`.
   */
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default nextConfig;
