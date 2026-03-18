## What

Add a first-class `release resume` command for interrupted durable release workflows.

## Why

The executor already persists resumable workflow state, but operators currently have to infer that rerunning `release apply` is safe. Making resume explicit lowers operator risk and makes the recovery path discoverable.

## How

- add a typed executor `resume()` API that refuses to resume plans with no persisted state or already-completed workflows
- add a `release resume` CLI command that inspects workflow state, confirms the resume intent, and then continues the durable workflow
- update operator-facing guidance and reuse the existing end-to-end resume scenarios through the explicit resume API

## Where

- `packages/release/src/api/executor/*`
- `packages/release/src/cli/commands/resume.ts`
- `packages/release/src/cli/help.ts`
- `packages/release/README.md`

## When

This builds directly on the status command so users can inspect an interrupted workflow and then resume it with the same plan.

## Verification

- `bun run --cwd packages/release check:types`
- `bun run --cwd packages/release test packages/release/src/api/executor/resume.test.ts packages/release/src/api/executor/e2e.test.ts packages/release/src/api/executor/status.test.ts packages/release/src/cli/help.test.ts`
- `bun run release:verify`

## Risks

- resume must not start fresh workflows by accident
- the command must preserve the same workflow identity as apply so durable checkpoints remain valid
