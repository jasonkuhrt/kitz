## What

Add `release notes --until <tag|sha>` and a shareable markdown output mode for `release forecast`.

## Why

Operators often need to talk about a precise release window and paste a human-readable forecast into PRs, issues, or handoff notes. The existing notes API already understands an upper boundary, and the forecast command already produces structured data, but the CLI does not expose those capabilities in a way that is easy to use or share.

## How

- wire the existing notes `until` boundary through the CLI so operators can bound notes end to end
- add a markdown forecast renderer that turns the lifecycle-agnostic forecast into a shareable summary with primary, cascade, and publish metadata sections
- document the new CLI workflows and cover the renderer contract with tests

## Where

- `packages/release/src/cli/commands/{notes,forecast}.ts`
- `packages/release/src/api/renderer/forecast-markdown.ts`
- `packages/release/src/api/renderer/forecast-markdown.test.ts`
- `packages/release/README.md`

## When

This follows custom plan-file support because both features improve the portability of release-package outputs across human and CI workflows.

## Verification

- `bun run --cwd packages/release test packages/release/src/api/notes/generate.test.ts packages/release/src/api/renderer/forecast-markdown.test.ts`
- `bun run --cwd packages/release check:types`
- `bun run release:verify`

## Risks

- the markdown forecast should stay stable enough to paste into issues without being overloaded with PR-preview-only affordances
- the notes boundary must remain consistent with the existing API semantics so callers do not get a wider commit range than they requested
