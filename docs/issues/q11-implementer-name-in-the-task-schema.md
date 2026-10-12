# Q11: the implementer name the task schema rejects

Opened 2026-10-12, when the site-translation plan was retired. The operator
has not answered this question. What happened is below.

The plan's task list named two implementers, `claude-lead` and `codex`. The
dispatch procedure routes to those names. The task schema allows `claude` or
`codex`.

## What happened

The task validator printed 23 errors, one per `claude-lead` task, all of the
kind "implementer must be claude or codex", and exited 1. Nothing else
failed: with that value read as `claude` the list was valid. The 46 tasks
were dispatched and built all the same.

The schema and the validator belong to the `lunar-base` rig, not to this
repository. Neither was changed.

## What is open for the operator

The task list was deleted with the plan, so nothing in this repository fails
today. The next plan written here for the same dispatcher meets the same 23
errors. Either the schema admits `claude-lead`, or the dispatcher maps
`claude` to it. That change is made in the `lunar-base` rig.
