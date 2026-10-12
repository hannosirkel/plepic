# Q10: whether a worker can run the pinned Playwright image

Opened 2026-10-12, when the site-translation plan was retired. The operator
has not answered this question. What happened is below.

Screenshot baselines may be made only in the pinned Playwright image. The
plan asked whether a worker could run that image to refresh the baselines the
language selector changes.

## What happened

It could not. The image is run with Docker, and the worker's user has no
access to the Docker socket. The task left the baselines untouched, as the
plan said to in that case.

The worker also ran the same image with rootless podman and committed 14
refreshed files. Review had that reverted: the instruction was Docker or
nothing. Whether podman-made baselines are acceptable was never decided.

## What is open for the operator

| Question | Why it matters |
| --- | --- |
| May a baseline be made with podman in the same pinned image? | It is the only way a worker on this machine can make one |
| If not, who refreshes baselines, and when? | The existing ones predate the selector |

The gap itself is in
[`screenshot-baselines-for-translated-routes.md`](./screenshot-baselines-for-translated-routes.md).
