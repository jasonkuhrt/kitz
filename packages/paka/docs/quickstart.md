---
title: Quickstart
lucid_generated: true
---

# Quickstart

This quickstart covers the two workflows that matter on this branch: extracting a package's interface model and calculating semver impact from two package roots.

## Extract one package

Use the flat `./__` surface when you want direct named imports:

```ts
import { extract } from '@kitz/paka/__'

const model = extract({
  projectRoot: '/absolute/path/to/package',
})

console.log(model.name)
console.log(model.entrypoints.map((entrypoint) => entrypoint.path))
```

When run against `packages/paka` in this worktree, that returns `@kitz/paka` with two entrypoints: `"."` and `"./__"`.

If you only care about one entrypoint, narrow the extraction:

```ts
import { extract } from '@kitz/paka/__'

const model = extract({
  projectRoot: '/absolute/path/to/package',
  entrypoints: ['./__'],
})
```

## Compare two package roots

If you want the highest-level semver workflow, compare roots directly:

```ts
import { analyzeSemverImpactFromProjectRoots } from '@kitz/paka/__'

const report = analyzeSemverImpactFromProjectRoots({
  previousProjectRoot: '/absolute/path/to/previous-package',
  nextProjectRoot: '/absolute/path/to/next-package',
  currentVersion: '0.5.0',
})

console.log(report.impact)
console.log(report.releaseBump)
console.log(report.nextVersion)
```

The report includes the overall impact plus a per-change list. If you already extracted both models, call `analyzeSemverImpact({ previous, next })` instead.

## Use the repo-local CLI prototype

The branch also adds a repo-local CLI entry script:

```bash
bun packages/paka/src/cli.ts semver \
  /absolute/path/to/previous-package \
  /absolute/path/to/next-package \
  --current-version 0.5.0
```

Against `main` versus this worktree's `packages/paka`, the command currently reports:

```text
Public interface impact: minor
Current version: 0.5.0
Release phase: initial
Release bump: minor
Next version: 0.6.0
```

That real comparison shows why the feature matters: the branch adds new semver exports, so the public surface change is visible without reading commit messages.

## Know the limits up front

- The analyzer only sees exported interface changes.
- Implementation-only fixes are outside its model, so it never infers `patch`.
- The CLI is source-driven today. `packages/paka/package.json` does not publish a `bin` entry yet.
