# Q5: whether URL paths are translated

Opened 2026-10-12, when the site-translation plan was retired. The operator
has not answered this question. The reading below is in force.

The brief does not say whether `/de/games/lunar-base` should be a German
path.

## Reading in force

No. Each edition serves the English paths under its prefix.

`ROUTE_PATHS` in `content/routes.ts` is the one place a path is written. A
translated path needs a second table per edition, and each such table can
drift from the first. Decision
[0001](../decisions/0001-locale-chosen-by-url.md) records this.

## If the answer differs

Translated paths need a path table per edition, a router that reads it, and a
redirect for every URL already published under `/de`, `/et` and `/tlh`. The
language selector, the canonical URLs, the `hreflang` sets and the sitemap
all build a URL from `ROUTE_PATHS` today.
