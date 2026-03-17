# Repo Gate Follow-Through: Fast-Check Alignment

## What

Pin the workspace-level `fast-check` version used by the repo root and `@kitz/test`.

## Why

The repo-wide package typecheck currently mixes `fast-check@4.4.0` and `fast-check@4.6.0`, which
breaks type compatibility between `@kitz/test` helpers and package tests that import `fast-check`
directly from the workspace root.

## How

- Pin the root workspace `fast-check` dependency to `4.4.0`.
- Pin `@kitz/test` to the same version.
- Reinstall and rerun the repo-wide type gate.

## Where

- `package.json`
- `packages/test/package.json`
- `bun.lock`

## When

This is a follow-through slice only because the broader repo gate blocked mergeability after the
`paka` work was already green.

## Verification

- `bun run check:types:packages`

## Risks

- This changes repo-wide dependency resolution, so it should stay small and be clearly separated
  from the `paka` feature work in review.
