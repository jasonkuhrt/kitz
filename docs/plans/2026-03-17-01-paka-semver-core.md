# Paka Semver Prototype: Core Analysis

## What

Add a first-class semver analysis module to `@kitz/paka` that compares two extracted public
interface models and reports the required public-interface impact.

## Why

`paka` already knows how to extract a package's exported interface. The missing step is turning
that extracted model into release guidance that can be reasoned about, tested, and later composed
into broader release automation.

## How

- Compare package entrypoints by export path.
- Compare exports recursively within each entrypoint, including nested namespaces.
- Classify additions as minor and removals or shape changes as major.
- Keep the output structured so later tooling can render either JSON or text without reparsing.
- Optionally map the public-interface impact through `@kitz/semver` phase rules when a current
  version is provided.

## Where

- `packages/paka/src/semver.ts`
- `packages/paka/src/__.ts`
- `packages/paka/package.json`

## When

This slice should land before tests and CLI work so the public contract is stable before we build
verification and UX around it.

## Verification

- `bun run --cwd packages/paka check:types`
- `bun run --cwd packages/paka check:lint`

## Risks

- Any signature-diff heuristic can over-classify changes as major.
- Entrypoint and namespace comparisons need to avoid duplicate noise when parent surfaces change.
