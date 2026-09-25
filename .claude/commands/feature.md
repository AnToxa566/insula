---
name: feature
description: Runs the full plan → approve → execute → review loop → architect sign-off cycle for a feature or change
disable-model-invocation: true
---

Run the full Insula development cycle for: $ARGUMENTS

1. **Plan.** Enter plan mode (or use the `planner` subagent for an isolated
   planning pass) to read AGENTS.md, ARCHITECTURE.md, and — if the task
   touches credentials/tokens/budgets — SECURITY.md, then produce a plan per
   the planner's format. Stop and show me the plan for approval before
   touching any files.

2. **Execute.** Once I approve, implement the plan step by step as the
   executor role: one step at a time, running verification commands after
   each, never skipping ahead.

3. **Review loop.** When implementation is reported done, use the `reviewer`
   subagent to review the diff in a fresh context against AGENTS.md,
   ARCHITECTURE.md, and SECURITY.md. If `VERDICT: CHANGES_REQUESTED`, fix the
   blocking items and re-run the reviewer. Repeat until `VERDICT: APPROVED`,
   or up to 5 rounds — if still not approved after 5 rounds, stop and show me
   the plan, the diff, and the last review so I can decide rather than keep
   looping.

4. **Architect sign-off.** Once the reviewer approves, use the `architect`
   subagent to check structural fit against ARCHITECTURE.md. If
   `VERDICT: CHANGES_REQUESTED`, fix and send back through the reviewer loop
   (step 3) before returning to the architect. Repeat until approved or 3
   rounds; same stop-and-ask rule as above.

5. **Done.** Summarize: what changed, which files, which commands were run
   and their results, and both verdicts. Wait for me before committing.
