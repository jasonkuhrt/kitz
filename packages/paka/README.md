# @kitz/paka

`@kitz/paka` reads a package's TypeScript exports and turns them into a structured interface model. That model is the common input for documentation generation, API inspection, and, on this branch, semver analysis based on the public surface instead of commit history.

## What paka does

`paka` works in three layers:

1. It reads `package.json#exports`, resolves the backing source files, and extracts modules, exports, signatures, docs, and source locations into an `InterfaceModel`.
2. It adapts that model into other outputs, such as VitePress-oriented API pages.
3. It compares two extracted models and reports whether the public interface change is `none`, `minor`, or `major`.

The branch in this worktree adds the third layer: a semver calculator that diffs two package roots and reports the release impact implied by exported surface changes alone.

## Published entrypoints

| Entrypoint | Shape | When to use it |
| --- | --- | --- |
| `@kitz/paka` | `Paka` namespace wrapper | Prefer this if you want a single namespace import. |
| `@kitz/paka/__` | Flat export surface | Prefer this if you want direct named imports for extraction, schema, and semver helpers. |

The package root currently exposes a single `Paka` export. The fuller API lives under `./__`.

## Quick look

Programmatic extraction:

```ts
import { extract } from '@kitz/paka/__'

const model = extract({
  projectRoot: '/absolute/path/to/package',
  entrypoints: ['./__'],
})

console.log(model.name)
console.log(model.entrypoints.map((entrypoint) => entrypoint.path))
```

Programmatic semver analysis:

```ts
import { analyzeSemverImpactFromProjectRoots } from '@kitz/paka/__'

const report = analyzeSemverImpactFromProjectRoots({
  previousProjectRoot: '/absolute/path/to/previous-package',
  nextProjectRoot: '/absolute/path/to/next-package',
  currentVersion: '0.5.0',
})

console.log(report.impact)
console.log(report.nextVersion)
```

Repo-local CLI prototype:

```bash
bun packages/paka/src/cli.ts semver \
  /absolute/path/to/previous-package \
  /absolute/path/to/next-package \
  --current-version 0.5.0
```

The CLI entry script exists in `packages/paka/src/cli.ts`. `package.json` does not publish a binary yet, so treat it as a repo workflow rather than a packaged command surface.

## Documentation

- [Overview](./docs/overview.md)
- [Quickstart](./docs/quickstart.md)
- [Guide: Extract interface models](./docs/guides/extract-interface-models.md)
- [Guide: Calculate semver from exports](./docs/guides/calculate-semver-from-exports.md)
- [Reference: Public API](./docs/reference/public-api.md)
- [Reference: CLI prototype](./docs/reference/cli.md)

## Scope and limits

- `paka` compares exported interface shape. It does not inspect runtime behavior or implementation-only changes.
- The semver analyzer intentionally reports `none`, `minor`, or `major`. It cannot infer `patch` from the public surface alone.
- `analyzeSemverImpactFromProjectRoots` is the highest-level semver entrypoint. Use `analyzeSemverImpact` when you already have extracted models.
- The current `generate` command is still repo-local and VitePress-oriented. It is useful for development, but it is not yet a general packaged CLI workflow.
