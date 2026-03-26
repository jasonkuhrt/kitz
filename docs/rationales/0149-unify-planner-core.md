# Refactor 149: Unify Lifecycle Planners Behind One Core

## What

Centralize the shared planning algorithm used by the official, candidate, and ephemeral planners.

## Why

All three planners currently repeat the same orchestration steps: filter impacts, build release items, build the dependency graph, derive cascades, and assemble the final `Plan`. Keeping that flow in three places makes it easy for planner behavior to drift as the package evolves.

## How

- Add a typed internal planner core that owns the shared orchestration flow.
- Keep lifecycle-specific version semantics explicit in the public planner entrypoints by passing lifecycle-specific item builders and cascade mappers into the core.
- Add focused tests for the shared planner flow while preserving the existing lifecycle planner tests.

## Where

- `packages/release/src/api/planner/core.ts`
- `packages/release/src/api/planner/core.test.ts`
- `packages/release/src/api/planner/official.ts`
- `packages/release/src/api/planner/candidate.ts`
- `packages/release/src/api/planner/ephemeral.ts`

## Verification

- `bun run --cwd packages/release test packages/release/src/api/planner/core.test.ts`
- `bun run release:verify`
