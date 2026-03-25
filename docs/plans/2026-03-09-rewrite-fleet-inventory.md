# Rewrite Fleet Inventory

Snapshot generated from `bun run fleet:scan` on March 9, 2026.

## Current Fleet

- 14 consumer repos under `/Users/jasonkuhrt/projects/jasonkuhrt`
- 9 Effect-based repos
- 1 legacy `@wollybeard/kit` repo
- 0 current `kitz` consumers before running `bun link`

## Immediate Rewrite Targets

- `bookmarks`
  Why: Effect-based already, YAML now has a kitz surface, and `plist` is the next obvious missing domain.
- `os`
  Why: Effect-based, already uses YAML, and schema/runtime validation can move toward `@kitz/sch`.
- `telescope`
  Why: Effect-based, YAML can move immediately, and the repo exposes two concrete next missing packages: `xml` and `json-patch`.
- `graphql-kit`
  Why: still on legacy `@wollybeard/kit`, so it is a high-value migration target even before a future `@kitz/graphql`.
- `flo`
  Why: Effect-based and mostly waiting on stronger markdown/document tooling plus filesystem/query ergonomics.

## Confirmed Public Kitz Surfaces

- `@kitz/yaml`
  Justified by `bookmarks`, `dotfiles`, `os`, and `telescope`.

## Next Missing Packages

- `@kitz/plist`
  Confirmed by `bookmarks`.
- `@kitz/xml`
  Confirmed by `telescope`.
- `@kitz/json-patch`
  Confirmed by `telescope`.
- `@kitz/markdown`
  Confirmed by `crossmod`, `flo`, and `template-typescript-lib`.

## Existing Packages To Expand

- `@kitz/fs`
  Replace recurring `fast-glob`, `tinyglobby`, and `picomatch` usage with a richer filesystem/query surface.
- `@kitz/sch`
  Absorb schema/runtime validation roles currently served by `ajv` and `zod`.

## Later Candidate

- `@kitz/graphql`
  Real demand exists in `graphql-kit`, but it is a larger surface and should come after the codec/document layers above.
