# Paka Semver Prototype: CLI Surface

## What

Add a `paka semver` command that compares two package roots and prints either a readable summary or
JSON.

## Why

The prototype needs a quick path from "two directories on disk" to "semver guidance" without
requiring callers to write their own extraction harness first.

## How

- Reuse the new project-root analyzer instead of duplicating extraction logic in the CLI.
- Support `--current-version` for phase-aware release mapping.
- Support `--json` for scripting and fixture generation.
- Keep the command grammar deliberately small: two positional roots plus optional flags.

## Where

- `packages/paka/src/cli.ts`

## When

This slice comes after the core API and tests so the CLI is a thin wrapper around a proven contract.

## Verification

- `bun run --cwd packages/paka test`
- `bun run --cwd packages/paka check:types`
- `bun run --cwd packages/paka check:lint`

## Risks

- The package still does not publish a formal `bin`, so this command is primarily a repo-local
  prototype for now.
