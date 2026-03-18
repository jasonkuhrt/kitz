## What

Add `release plan --out <file>` and `release apply --from <file>`.

## Why

The release workflow currently assumes a single active plan at `.release/plan.json`. That is ergonomic for the common path, but it blocks operators and CI from staging multiple release plans side by side or passing a generated snapshot between steps without mutating the default location.

## How

- extend the shared planner store so callers can read, write, and delete either the default active plan or a caller-supplied plan file
- wire `plan --out` and `apply --from` through that shared store so both commands agree on path resolution and cleanup behavior
- keep the default `.release/plan.json` workflow unchanged when no custom path is provided

## Where

- `packages/release/src/api/planner/{resource,store}.ts`
- `packages/release/src/api/planner/store.test.ts`
- `packages/release/src/cli/commands/{plan,apply}.ts`
- `packages/release/README.md`

## When

This follows explicit package path support because both features make release execution easier to script in nontrivial repository and CI layouts.

## Verification

- `bun run --cwd packages/release check:types`
- `bun run --cwd packages/release test packages/release/src/api/planner/store.test.ts`
- `bun run release:verify`

## Risks

- the default active-plan UX must stay unchanged so existing local workflows remain simple
- custom plan paths must resolve relative to the repository cwd consistently in both `plan` and `apply`
