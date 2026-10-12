# Source comments name the retired plan directory

Opened 2026-10-12, in the change that retired the site-translation plan. That
change was limited to documents, so it did not edit these files.

## What is open

The language conventions moved from `docs/working/site-translation/` to
[`docs/current/translation/`](../current/translation/). Seven TypeScript files
still name the old path.

| File | Names |
| --- | --- |
| `content/de/interface.ts` | `de.md`, in a comment |
| `content/de/proof.ts` | `de.md`, in a comment |
| `content/de/publisher.ts` | `de.md`, in a comment |
| `content/de/shop.ts` | `de.md`, in a comment |
| `content/de/support.ts` | `de.md`, in a comment |
| `content/legal/de/imprint.ts` | `de.md`, in a comment |
| `content/glossary/index.ts` | `et.md`, in the reason of a `glossaryExceptions` entry |

Each names the path in prose. None is a link, so no check fails.

Ten further files under `content/legal/de/` and `content/legal/tlh/` say "the
site-translation job" when they record the operator's approval of 2026-10-10.
That names the job, not a path, and stays true.

## What closing it takes

Replace `docs/working/site-translation/` with `docs/current/translation/` in
the seven files. The entry in `content/glossary/index.ts` is a string value,
not a comment; no test reads its wording.
