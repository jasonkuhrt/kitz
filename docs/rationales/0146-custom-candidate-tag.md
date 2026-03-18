# Bug 146: Support Custom Candidate Dist-Tags

## What

Make executor candidate behavior derive from candidate lifecycle semantics and the configured dist-tag instead of the literal string `next`.

## Why

Custom candidate channels already flow through release config and `apply`, but workflow execution still special-cased `next` for force-pushing tags, updating existing candidate releases, and GitHub release titles.

## How

- Add a workflow helper that resolves the candidate dist-tag from payload lifecycle and runtime options.
- Use that helper for candidate push behavior and GitHub release create/update behavior.
- Generate candidate GitHub release titles from the real dist-tag.
- Cover the regression with executor tests for custom candidate release update/create paths and the candidate force-push path.

## Where

- `packages/release/src/api/executor/workflow.ts`
- `packages/release/src/api/executor/_.test.ts`
- `packages/git/src/memory.ts`
- `packages/git/src/_.test.ts`

## When

This closes the remaining candidate-tag correctness gap before the final bug fixes move into config and preview behavior.

## Verification

- `bun run --cwd packages/release test packages/release/src/api/executor/_.test.ts --testNamePattern "updates existing GitHub candidate release"`
- `bunx vitest run --dir packages/git/src packages/git/src/_.test.ts --testNamePattern "pushTag records tag, remote, and force flag"`
- `bun run release:verify`

## Risks

- Durable workflow payloads created before lifecycle was recorded could still exist, so the helper keeps a narrow legacy fallback for the historic `next` case.
