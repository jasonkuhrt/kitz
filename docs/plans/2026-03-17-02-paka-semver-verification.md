# Paka Semver Prototype: Verification

## What

Add package-local tests and a canonical Bun test script for the semver prototype.

## Why

The new analyzer is a judgment engine. Its value comes from stable classifications of
entrypoint and export changes, so we need direct examples that pin those classifications down.

## How

- Build synthetic packages with `extractFromFiles` and `Fs.Builder.spec(...)`.
- Assert on impact classification rather than only on rendered text.
- Cover unchanged, additive, removal, signature-change, namespace, and phase-mapping cases.
- Add a package-level `test` script so the repo-wide workspace test runner picks `paka` up.

## Where

- `packages/paka/src/semver.test.ts`
- `packages/paka/package.json`

## When

This slice follows the core API so tests can lock the contract before CLI wiring and docs.

## Verification

- `bun run --cwd packages/paka test`

## Risks

- Synthetic fixtures can miss real-world filesystem quirks, so the CLI slice should still exercise
  the analyzer against project roots.
