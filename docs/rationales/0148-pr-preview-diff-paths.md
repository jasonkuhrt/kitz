# Bug 148: Remove PR Preview Diff Layout Assumptions

## What

Teach diff-aware preview and doctor checks to use the configured git remote and the real resolved package paths.

## Why

The old implementation only diffed against `origin/<base>` and only marked packages as affected when files lived under `packages/<scope>/...`. That broke preview and doctor in repos that publish from a non-`origin` remote or lay packages out anywhere else in the workspace.

## How

- Extract PR diff loading into a small helper module that stays independent from the heavier preview command surface.
- Resolve the diff remote from the existing `env.git-remote` rule options so diff-aware checks and remote validation share one source of truth.
- Route preview and doctor through that shared configured-diff entrypoint so one regression test can cover the non-`origin` path end to end.
- Match changed files against actual resolved package directories relative to the repo root instead of assuming `packages/<scope>`.
- Keep the config schema companion statics intact with the current Effect APIs so the canonical verification gate stays usable.
- Cover the regression with focused tests for remote resolution, configured diff loading, and affected-package detection.

## Where

- `packages/release/src/cli/pr-preview-diff.ts`
- `packages/release/src/cli/pr-preview-diff.test.ts`
- `packages/release/src/cli/pr-preview.ts`
- `packages/release/src/cli/commands/doctor.ts`

## Verification

- `bun run --cwd packages/release test packages/release/src/cli/pr-preview-diff.test.ts`
- `bun run release:verify`
