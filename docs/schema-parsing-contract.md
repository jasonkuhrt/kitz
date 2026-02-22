# Schema Parsing Contract

## Goal

Keep parsing and serialization behavior consistent across packages:

- Literal TypeScript parsing stays in `fromLiteral` APIs.
- Runtime/external string decoding goes through Effect schema codecs.
- Stringification is done at IO edges (CLI output, git tags, JSON, logs), not mid-domain.

## Canonical Pattern

1. Define structured schema/model types (tagged class style).
2. Define `FromString` schema codecs for external strings.
3. Define `fromLiteral` helpers for compile-time literal routing and type inference.
4. Keep `fromString` as a convenience runtime constructor for trusted/internal strings.
5. Repo-wide rule: if a parser is literal-aware (type-level inference/validation from string literals), it must expose `fromLiteral`.

## Release Tag Rules

- Exact release tags (`<moniker>@<version>`) must decode via `Pkg.Pin.Exact.FromString`.
- Do not parse release tags via `split('@')`, `lastIndexOf('@')`, or custom `parse*ReleaseTag` helpers.
- Prefer Semver combinators (`withPre`, `stripPre`, `getPrerelease`) over semver string concatenation.

## Enforced Checks

`tools/check-api-model-style.mjs` enforces:

- No ad-hoc exact release-tag parsers in `packages/release/src/api`.
- No manual `@`-split parsing for release tags in `packages/release/src/api`.
- No `Semver.fromString` template-literal construction in `packages/release/src/api`.
- Repo-wide: literal-aware `fromString` parser APIs must also expose `fromLiteral`.
- `packages/pkg/src/pin/pin.ts` must expose:
  - `Exact.FromString`
  - `fromLiteral` literal-parser API
