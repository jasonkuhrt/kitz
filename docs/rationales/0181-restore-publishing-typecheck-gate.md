# 0181 Restore Publishing Typecheck Gate

## Context

`Publishing` still used direct `Schema.decode(Publishing)` and `Schema.encode(Publishing)` statics inside the class body.

## Decision

Align `Publishing` with the package's other schema classes by using the `decodeUnknown*` and `encodeUnknown*` helpers.

## Result

The class keeps the same public helper surface, but `check:types` no longer trips over self-referential implicit `any` initializers and `release:verify` can run again.
