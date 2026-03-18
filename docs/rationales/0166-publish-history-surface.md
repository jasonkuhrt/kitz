# 0166: Publish History Surface

## Context

Preview comments already persisted publish state and publish history through hidden metadata markers, but operators had no first-class CLI surface for reading that state back.

## Decision

Add a root `release history` command that:

- resolves the connected pull request, or an explicit `--pr <number>` override
- reads the existing preview marker comment instead of scraping rendered markdown
- parses the embedded metadata through the existing commentator metadata model
- renders either human-readable text or machine-readable JSON

## Why This Shape

- Keeps the preview comment metadata as the single source of truth for preview publish history.
- Avoids coupling the surface to durable workflow state, which answers a different question.
- Makes ad hoc operator checks and CI automation equally straightforward.

## Testing

- metadata ordering is covered at the commentator layer
- preview metadata resolution and report rendering are covered in `history-lib.test.ts`
- root help output includes the new command
