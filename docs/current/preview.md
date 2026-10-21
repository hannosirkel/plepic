# Pull request previews

Applying the `preview` label to a pull request publishes a static snapshot of
that pull request's head revision to GitHub Pages, so a change to the storefront
can be looked at before it is merged.

The workflow is `.github/workflows/preview.yml`. The snapshot is produced by
`scripts/preview-snapshot.mjs`.

## What the label does

- Applying `preview` publishes the pull request's current head.
- Pushing to a pull request that still carries the label refreshes the preview.
- Removing the label does not unpublish anything; the preview stays until
  another pull request replaces it.
- There is **one** Pages site per repository, so the most recently labelled
  pull request wins. A newer run cancels an older one in progress.
- When a deployment succeeds, the workflow posts the URL in a single comment on
  the pull request and edits that comment on later pushes.

The site is served at `https://<owner>.github.io/plepic/`.

## Who can trigger it

A preview is published only if all of these hold when the workflow runs:

- the pull request is open;
- its head branch is in this repository (a pull request from a fork never
  deploys);
- it carries the `preview` label;
- the person who most recently applied that label holds `admin`, `maintain` or
  `write` access. A user with only `triage` access can apply labels and cannot
  publish.

The check is on who applied the label, read from the pull request's issue
events, not on who pushed. A push by someone else refreshes a preview only
because a person with write access applied the label that is still on the pull
request.

The workflow uses `pull_request`, not `pull_request_target`. The code it builds
is the pull request's, so it runs with a read-only token and no secrets. Only
the final job holds the Pages grant, and it runs no pull request code.

## What the snapshot is

The storefront cannot be exported statically: it reads request headers, has
server actions, mints a Content-Security-Policy nonce per request and runs a
proxy. So the workflow builds the storefront as CI does, starts it against the
same Medusa fixture the browser suite uses with synthetic environment values,
and requests every page.

- Every page of all four editions from the sitemap, plus the pages they link to
  (the basket included), and every stylesheet and image they
  reference.
- The rulebook PDFs from `storefront/public/documents/`.
- Server-rendered HTML and CSS only. Every `<script>` is removed, because
  Next's client JavaScript loads chunks from absolute `/_next/` paths and cannot
  start under a sub-path.
- Every internal link and asset reference is rewritten to a relative one, so the
  snapshot works under `/plepic/`.
- Every page carries a banner, "Preview of pull request #N (sha) — not the shop.
  Forms and basket do not work.", and `<meta name="robots" content="noindex">`.
  The canonical, alternate and share-image tags are removed.
- No live hostname and no real key. The build uses `preview.example.org`
  (a reserved example name) and fixture keys.
- `404.html` is a plain page, not the storefront's own not-found page: Next
  streams a 404 as an empty shell and draws the message with client JavaScript.

The snapshot script refuses to publish if any page still holds a `<script>`, an
absolute internal reference, the synthetic host name or a nonce, or lacks the
banner or `noindex`.

## What it is not

- It is not the shop. Forms, the basket and every other client behaviour do
  not work, and the Medusa backend is a fixture.
- It is not a test of behaviour. It shows layout, copy and styling as the
  server renders them.
- Links to things the storefront does not serve are dead: the online game under
  `/play/` lives on another service. The script prints these as warnings, as it
  does for a linked document that does not exist yet.

## Merging carries nothing

The snapshot is built in the workflow run and handed to Pages as a deployment
artifact. It is never committed to any branch, so a merge brings no artifact,
and no branch holds a copy.

## One-time repository settings

Both are the operator's to make once. The workflow cannot make them.

1. **Pages source: GitHub Actions.** Repository settings, Pages, Build and
   deployment, Source: GitHub Actions.
2. **The `github-pages` environment must accept pull request branches.**
   Repository settings, Environments, `github-pages`, Deployment branches and
   tags. The default for this environment allows only the default branch,
   which refuses a deployment from a pull request's `refs/pull/N/merge` ref.
   Either choose "No restriction", or select "Selected branches and tags" and
   add the pattern `refs/pull/*/merge`. Check the deployment after the first
   labelled pull request: a refusal appears as a failed `deploy` job naming the
   environment's protection rule.

Because the environment gate is the only thing that decides which refs may
publish, prefer the second form of setting 2 if it works for your account.
