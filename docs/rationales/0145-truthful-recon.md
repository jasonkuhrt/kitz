# Bug 145: Make Recon Truthful

## What

Replace placeholder npm and git remote fields in `Api.Explorer.explore()` with values gathered from the runtime.

## Why

`Recon` is consumed as an environment snapshot. Hardcoded npm auth values and empty remotes made the API claim facts it had not actually observed.

## How

- Preserve npm's own registry resolution when no explicit registry environment variable is set.
- Use the existing `@kitz/npm-registry` Effect service to run `npm whoami` and reflect the actual authentication result without turning missing auth into a fatal explorer failure.
- Read the configured `origin` remote and include it in `recon.git.remotes`.
- Thread the npm service into CLI entrypoints that call `explore()`.
- Lock the behavior with a regression test that failed against the old placeholder implementation.

## Where

- `packages/release/src/api/explorer/explore.ts`
- `packages/release/src/api/explorer/explore.test.ts`
- `packages/release/src/cli/commands/forecast.ts`
- `packages/release/src/cli/commands/pr.ts`

## When

This keeps the remaining bug fixes working off a more trustworthy runtime snapshot before we move deeper into release execution and preview behavior.

## Verification

- `bun run --cwd packages/release test packages/release/src/api/explorer/explore.test.ts`
- `bun run release:verify`

## Risks

- Explorer now depends on the npm CLI service in more command entrypoints, so the command layer wiring must stay aligned anywhere `explore()` is invoked.
