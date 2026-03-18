# Bug 147: Remove the Dead `skipNpm` Config Surface

## What

Remove `skipNpm` from the public release config surface.

## Why

`skipNpm` was documented and resolved into runtime config, but no release code actually consulted it. Keeping a dead release toggle is worse than removing it because operators can believe a safety switch exists when it does not.

## How

- Delete `skipNpm` from the config schema and resolved config shape.
- Remove the stale README example entry.
- Point operators at the real preview path: `release apply --dry-run`.
- Cover the regression with a package-level test that proves the inert config key is no longer exposed or documented.

## Where

- `packages/release/src/api/config.ts`
- `packages/release/src/_.test.ts`
- `packages/release/README.md`

## Verification

- `bun run --cwd packages/release test packages/release/src/_.test.ts --testNamePattern "does not expose inert skipNpm configuration"`
- `bun run release:verify`
