## What

Add a `release graph` command that renders the release execution DAG for the active plan.

## Why

The executor already knows the exact durable workflow layers and dependency edges, but operators have no direct way to inspect that graph when planning or debugging a release.

## How

- extract a typed executor `graph()` API from the observable execution surface
- add a graph renderer for readable text output plus a JSON projection for tooling
- expose the graph through `release graph` with shared plan and publish-identity resolution

## Where

- `packages/release/src/api/executor/execute.ts`
- `packages/release/src/api/renderer/graph.ts`
- `packages/release/src/cli/commands/graph.ts`
- `packages/release/README.md`

## When

This fits immediately after the new status and resume commands because it gives operators another durable-workflow inspection surface without changing release execution semantics.

## Verification

- `bun run --cwd packages/release check:types`
- `bun run --cwd packages/release test packages/release/src/api/executor/graph.test.ts packages/release/src/api/renderer/graph.test.ts packages/release/src/cli/help.test.ts`
- `bun run release:verify`

## Risks

- the command must preserve the same workflow identity inputs as apply/status/resume
- the text renderer needs to stay readable for multi-package layered DAGs
