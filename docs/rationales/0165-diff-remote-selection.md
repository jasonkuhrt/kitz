## What

Add explicit diff-remote selection to `release pr preview` and `release doctor`.

## Why

Release preview and doctor already know how to compute PR diffs against a non-`origin` remote, but that behavior is only reachable indirectly through config. Operators working from forks or alternate remotes need a first-class override they can pass on the command line for one-off runs, and the preview runbook should echo the same override so the suggested commands stay faithful.

## How

- let diff-remote resolution prefer an explicit CLI override over config and then fall back to `origin`
- thread the override through preview diff loading and doctor’s PR-aware checks
- update the preview manual runbook and deferred-check commands so they include `--remote <name>` when the operator used an explicit override

## Where

- `packages/release/src/cli/pr-preview-diff.ts`
- `packages/release/src/cli/pr-preview.ts`
- `packages/release/src/cli/commands/{pr,doctor}.ts`
- `packages/release/src/cli/pr-preview{,-diff}.test.ts`
- `packages/release/README.md`

## When

This follows the shareable forecast work because both features tighten operator-facing CLI ergonomics without changing release planning semantics.

## Verification

- `bun run --cwd packages/release test packages/release/src/cli/pr-preview-diff.test.ts packages/release/src/cli/pr-preview.test.ts`
- `bun run --cwd packages/release check:types`
- `bun run release:verify`

## Risks

- explicit remote overrides must not silently drift from the commands shown in the preview runbook
- the default path still needs to remain `origin` or configured `env.git-remote` so existing automation stays unchanged
