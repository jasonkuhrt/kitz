# Refactor 150: Centralize Package Location Resolution

## What

Introduce a shared package-location abstraction that derives repo-relative package paths from the repo root and package directory.

## Why

Release surfaces were independently assuming `packages/<scope>` when they needed a source URL or a package-path match. That duplicated repo-layout knowledge and broke custom workspace layouts even when package discovery had already resolved the real package directories.

## How

- Add a typed `PackageLocation` helper that can derive repo-relative paths from discovered package directories and infer the default configured fallback layout in one place.
- Thread the git repo root through `Recon` so forecast generation can build source URLs from real package locations.
- Switch forecast source URLs and PR diff package matching to the shared package-location helper instead of rebuilding layout assumptions inline.
- Add focused tests for custom-layout source URLs, location derivation, and preview diff matching.

## Where

- `packages/release/src/api/analyzer/package-location.ts`
- `packages/release/src/api/analyzer/workspace.ts`
- `packages/release/src/api/forecaster/forecast.ts`
- `packages/release/src/cli/pr-preview-diff.ts`

## Verification

- `bun run --cwd packages/release check:types`
- `bun run --cwd packages/release test packages/release/src/api/analyzer/package-location.test.ts packages/release/src/api/analyzer/workspace.test.ts packages/release/src/api/explorer/explore.test.ts packages/release/src/api/forecaster/forecast.test.ts packages/release/src/cli/pr-preview-diff.test.ts`
- `bun run release:verify`
