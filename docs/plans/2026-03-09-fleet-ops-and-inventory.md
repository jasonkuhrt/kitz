# Rewrite Fleet Ops And Inventory

## What

Add internal workspace scripts that scan `/Users/jasonkuhrt/projects/jasonkuhrt/*` for consumer repos and apply `bun link` across that fleet without pretending the workflow is a public `kitz` package.

## Why

The rewrite effort needs a concrete control surface for day-to-day operations:

- see which repos are immediate rewrite candidates
- see which repos already align with Effect or legacy kit surfaces
- see which missing `@kitz/*` domains are actually justified
- wire `kitz` into those repos quickly via `bun link`

This is repo-local operational tooling, not a public abstraction boundary.

## How

- add `tools/fleet-lib.ts` for repo discovery, manifest inspection, opportunity inference, and report rendering
- add `tools/fleet.ts` for two commands:
  - `scan`: text, JSON, or markdown inventory
  - `link`: register this repo with `bun link`, then link `kitz` into matching sibling repos
- expose the workflow through root package scripts

## Where

- `tools/fleet-lib.ts`
- `tools/fleet.ts`
- root `package.json`

## When

Use this before each rewrite batch to decide where the next `kitz` package or migration pass belongs.

## Verification

- `bun run test:fleet`
- `bun run check:lint -- tools/fleet.ts tools/fleet-lib.ts tools/fleet-lib.test.ts`

## Risks

- opportunity inference is heuristic; it should drive planning, not silently mutate code
- `fleet:link` changes external repos only when explicitly run
