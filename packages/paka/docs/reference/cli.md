---
title: CLI Prototype
lucid_generated: true
---

# CLI prototype

`packages/paka/src/cli.ts` is a repo-local entry script. It is useful for development in this monorepo, but `packages/paka/package.json` does not publish a binary yet.

Current usage:

```text
Usage:
  paka generate
  paka semver <previous-project-root> <next-project-root> [--current-version <version>] [--json]
```

## `paka semver`

Compare two package roots and report the public-interface impact.

### Positional arguments

| Argument | Meaning |
| --- | --- |
| `<previous-project-root>` | Package root used as the baseline. |
| `<next-project-root>` | Package root used as the candidate surface. |

### Flags

| Flag | Meaning |
| --- | --- |
| `--current-version <version>` | Adds release-phase mapping and computes `releaseBump` and `nextVersion`. |
| `--json` | Emits the structured `SemverReportSchema` encoding instead of plain text. |

### Behavior

`paka semver` resolves both roots to absolute paths, extracts each package with `analyzeSemverImpactFromProjectRoots`, and then renders either JSON or text.

Plain text is for human review:

```text
Public interface impact: minor
Current version: 0.5.0
Release phase: initial
Release bump: minor
Next version: 0.6.0
```

JSON is for automation. It includes the full `changes` array with stable selectors for entrypoints and nested export paths.

## `paka generate`

Generate docs from extracted interface data.

### Current behavior

The command:

1. extracts interface data from the current working directory
2. writes the intermediate model to `docs/.generated/interface.json`
3. writes VitePress markdown output under `docs/api`
4. writes generated sidebar data under `docs/.generated/sidebar.ts`
5. formats markdown and post-processes TypeScript code blocks

### Important caveat

`generate` is not yet a general package CLI. Its entrypoint list is currently hard-coded in `src/cli.ts`, so it is best understood as a repo development workflow rather than a stable end-user surface.
