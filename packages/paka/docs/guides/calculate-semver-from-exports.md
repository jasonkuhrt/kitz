---
title: Calculate Semver From Exports
lucid_generated: true
---

# Calculate semver from exports

Use this workflow when you want release impact from the public interface itself. `@kitz/paka` compares two extracted package surfaces and reports what changed in a way that is reviewable and testable.

## Pick the comparison level

There are two entrypoints into the feature:

- `analyzeSemverImpactFromProjectRoots`: start from two package roots on disk.
- `analyzeSemverImpact`: start from two already-extracted `InterfaceModel` values.

Use the root-based API unless you already have the extracted models for another reason.

## Compare two package roots directly

```ts
import { analyzeSemverImpactFromProjectRoots } from '@kitz/paka/__'

const report = analyzeSemverImpactFromProjectRoots({
  previousProjectRoot: '/absolute/path/to/previous-package',
  nextProjectRoot: '/absolute/path/to/next-package',
  currentVersion: '0.5.0',
})
```

`currentVersion` is optional. Without it, the report stops at public impact. With it, the report also tells you the release phase, the mapped bump, and the next version.

## Understand the rules

The comparison is intentionally simple:

- added public export: `minor`
- removed public export: `major`
- changed public export signature: `major`
- added public entrypoint: `minor`
- removed public entrypoint: `major`
- changed entrypoint import shape: `major`

There is no `patch` result. The analyzer only sees the exported surface, so implementation-only fixes are invisible by design.

## Read a real report

This branch adds new semver exports to `packages/paka`. Comparing `main` against this worktree currently yields:

```text
Public interface impact: minor
Current version: 0.5.0
Release phase: initial
Release bump: minor
Next version: 0.6.0
```

The full change list includes additions under both `"."` and `"./__"`, which is expected for this package. The root entrypoint wraps the flat API in the `Paka` namespace, so new semver helpers appear in both surfaces.

## Use the repo-local CLI

```bash
bun packages/paka/src/cli.ts semver \
  /absolute/path/to/previous-package \
  /absolute/path/to/next-package \
  --current-version 0.5.0
```

Add `--json` when you want the structured report instead of the plain-text rendering:

```bash
bun packages/paka/src/cli.ts semver \
  /absolute/path/to/previous-package \
  /absolute/path/to/next-package \
  --current-version 0.5.0 \
  --json
```

The JSON path is useful for automation because it serializes the same `SemverReportSchema` the library exports.

## Use the lower-level API when extraction is already done

```ts
import { analyzeSemverImpact, extract } from '@kitz/paka/__'

const previous = extract({ projectRoot: '/absolute/path/to/previous-package' })
const next = extract({ projectRoot: '/absolute/path/to/next-package' })

const report = analyzeSemverImpact({
  previous,
  next,
  currentVersion: '0.5.0',
})
```

This is the right shape when extraction is already part of a larger workflow and you do not want to read the same package roots twice.
