## What

Add explicit package path support to `release.config.ts`.

## Why

The release package can already discover nonstandard layouts when the workspace scan succeeds, but the config contract itself still only expresses scope-to-name shorthand. Real monorepos need a first-class way to pin package paths when layout discovery is unavailable or intentionally overridden.

## How

- extend the config schema so each package entry can be either a shorthand package name or a structured `{ name, path }` object
- teach workspace resolution to honor explicit repo-relative paths while keeping shorthand and auto-scan behavior intact
- cover the new shape with config schema tests plus workspace and command bootstrap tests

## Where

- `packages/release/src/api/config.ts`
- `packages/release/src/api/analyzer/workspace.ts`
- `packages/release/src/cli/commands/command-workspace.ts`
- `packages/release/README.md`

## When

This follows the ephemeral dist-tag work because both features tighten operator-facing configuration and execution behavior around nonstandard release setups.

## Verification

- `bun run --cwd packages/release check:types`
- `bun run --cwd packages/release test packages/release/src/api/config.test.ts packages/release/src/api/analyzer/workspace.test.ts packages/release/src/cli/commands/command-workspace.test.ts`
- `bun run release:verify`

## Risks

- explicit paths must stay repo-relative so config cannot silently point outside the workspace root
- shorthand scope-to-name entries must keep their current ergonomic behavior so existing configs do not become noisier
