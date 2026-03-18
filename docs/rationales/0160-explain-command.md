## What

Add a `release explain <pkg>` command that explains why a package is a primary release, a cascade release, or unchanged.

## Why

The analyzer and planner already compute the release state, but operators still have to reverse-engineer why a specific package did or did not end up in that state. A direct explanation command makes the release surface much easier to trust and debug.

## How

- add a typed planner `explain()` API that resolves primary, cascade, unchanged, and missing-package outcomes
- derive concrete cascade dependency paths from the workspace runtime dependency graph so transitive cascades stay explainable
- add a dedicated renderer and expose the result through `release explain <pkg>` with optional JSON output

## Where

- `packages/release/src/api/planner/explain.ts`
- `packages/release/src/api/renderer/explain.ts`
- `packages/release/src/cli/commands/explain.ts`
- `packages/release/README.md`

## When

This fits naturally after the new status, resume, and graph surfaces because it gives operators a package-level explanation tool to pair with the broader workflow inspection commands.

## Verification

- `bun run --cwd packages/release check:types`
- `bun run --cwd packages/release test packages/release/src/api/planner/explain.test.ts packages/release/src/api/renderer/explain.test.ts packages/release/src/cli/help.test.ts`
- `bun run release:verify`

## Risks

- the explanation logic must stay aligned with analyzer/planner release classification rather than re-implementing a slightly different decision model
- cascade paths need to remain readable even when the dependency chain is transitive
