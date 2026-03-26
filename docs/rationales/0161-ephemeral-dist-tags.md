## What

Make ephemeral releases derive their npm dist-tag automatically from the planned PR number.

## Why

Ephemeral releases are already PR-scoped in their version format, but publishing still falls back to a generic dist-tag unless operators remember to override it manually. That makes preview channels harder to discover and easier to collide.

## How

- add a shared publish-semantics helper that can derive lifecycle behavior from a concrete plan
- format ephemeral dist-tags as `pr-<prNumber>` by default while still allowing explicit overrides
- update apply, resume, status, graph, and PR preview runbook surfaces to use the same plan-derived dist-tag behavior

## Where

- `packages/release/src/api/publishing.ts`
- `packages/release/src/cli/commands/{apply,graph,resume,status}.ts`
- `packages/release/src/cli/pr-preview.ts`
- `packages/release/README.md`

## When

This follows the explain command because it tightens another operator-facing part of the ephemeral release workflow without changing release planning itself.

## Verification

- `bun run --cwd packages/release check:types`
- `bun run --cwd packages/release test packages/release/src/api/publishing.test.ts packages/release/src/cli/pr-preview.test.ts`
- `bun run release:verify`

## Risks

- every surface that derives workflow identity must agree on the same ephemeral dist-tag or resume/status lookups will drift
- explicit `--tag` overrides must remain available for advanced cases without becoming the default workflow again
