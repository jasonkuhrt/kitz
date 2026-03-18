# Release Issue #144: Honor Notes `until` Boundary

## What

Teach `Api.Notes.generate()` to respect its advertised `until` option when computing package release notes.

## Why

Callers can currently pass `until`, but the implementation ignores it and always analyzes the full range since the last release tag. That widens release notes, overstates semantic impact, and makes bounded note generation unreliable.

## How

- trim the fetched commit window to the requested upper boundary before extracting impacts
- support both SHA and tag boundaries
- resolve boundaries that are outside the initially fetched window by asking git for commits since `until`
- fail when git can prove the requested boundary exists but cannot be loaded correctly
- preserve the previous behavior only when `until` is truly unknown

## Where

- `packages/release/src/api/notes/generate.ts`
- `packages/release/src/api/notes/generate.test.ts`

## When

This is bug-fix work and needs to land before refactors or feature work that depends on trustworthy note generation.

## Verification

- `bun run --cwd packages/release test packages/release/src/api/notes/generate.test.ts`
- `bun run release:verify`

## Risks

- off-by-one mistakes when trimming the commit window around the requested boundary
- stale tag snapshots causing false fallbacks instead of bounded notes
- treating real git lookup failures as "unknown boundary" and silently widening the range
