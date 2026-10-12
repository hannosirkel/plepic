# Screenshot baselines for translated routes

Opened 2026-10-12, when the site-translation plan was retired. The plan left
this out of scope.

## What is open

| Gap | Detail |
| --- | --- |
| Translated routes have no baseline | `storefront/tests/screenshots/` holds 32 files. Two are of a translated route: `localized-imprint-desktop.png` and `localized-imprint-mobile.png`, the Estonian imprint. No German or Klingon page has one, and no Estonian page beyond the imprint |
| The existing baselines predate the language selector | The selector was added to the header and the footer of every page. The 30 other baselines were made before it and were not refreshed |

## Why it was left open

A baseline may be made only in the pinned Playwright image
([`README.md`](../../README.md), section Browser screenshots). The image is
run with Docker. Docker was not available to the worker: the Docker socket
answered "permission denied".

The task that added the selector refreshed 14 baselines with rootless podman
in the same image. Review asked for that to be reverted, because the task
said to leave the baselines untouched without Docker. Commit `24e233b` is the
revert. Its hand-over records that each capture still passed against its old
baseline within `maxDiffPixelRatio`, so a plain `--update-snapshots` rewrites
nothing.

Functional browser checks cover the translated routes without a baseline:
that a route renders, that the selector moves between editions, and that
Klingon text keeps its case (`storefront/tests/playwright/storefront.spec.ts`).

## What closing it takes

1. Someone with Docker refreshes the existing baselines with the command in
   `README.md`. The old files have to be removed first: while a capture
   passes within tolerance, the command does not rewrite its file.
2. The operator decides which translated routes get a baseline. Every route
   in three editions at two viewports is 66 files, and two of them exist.
3. Add the chosen routes to `visualRoutes` in the Playwright spec and make
   their baselines in the same image.

See also [`q10-pinned-image-on-a-worker.md`](./q10-pinned-image-on-a-worker.md).
