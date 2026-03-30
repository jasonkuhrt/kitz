# 0002 Custom @kitz/fuzzy Package Over Third-Party Library

## Context

cmx needs a fuzzy matching subsystem for both the Command Resolver and Slot Resolver. The main candidates were uFuzzy (the leading actively-maintained JS fuzzy library) and building a custom `@kitz/fuzzy` package.

## Decision

Build `@kitz/fuzzy` (~200 lines, zero dependencies) combining fzy's two-matrix DP core with fzf's character-class bonus system.

uFuzzy is misaligned with cmx:

- **No composite score** — uFuzzy deliberately rejects single-number scores, exposing raw counters. cmx's `FuzzyMatcher` interface requires `{ candidate, score }`. Using uFuzzy means reimplementing a scoring algorithm on top of a library that refuses to have one.
- **Always case-insensitive** — cmx needs case-insensitive matching with a +1 exact-case scoring bonus. uFuzzy cannot distinguish `C` from `c`.
- **Regex architecture limits scoring granularity** — scoring info is extracted via regex captures, not character-by-character DP alignment. Cannot compute per-position bonuses for camelCase transitions or word boundaries.
- **Latin-only by default** — Unicode mode is 50-75% slower.

fuse.js was disqualified entirely — it uses edit-distance (Bitap), not subsequence matching. Wrong algorithmic family for command palette use.

The algorithm is not novel. fzy's DP is used by GitHub.com. fzf's scoring constants are used by millions of terminal users. The contribution is packaging them together cleanly in JS for the first time.

## Result

`@kitz/fuzzy` provides: `hasMatch`, `score`, `positions`, `match` — all pure functions. cmx wraps these in a pluggable `FuzzyMatcher` Effect service. The scoring constants (from fzf) and DP formulation (from fzy) are battle-tested. The package is ~200 lines with zero dependencies.
