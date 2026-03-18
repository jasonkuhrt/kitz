---
title: Extract Interface Models
lucid_generated: true
---

# Extract interface models

Use this workflow when you want a typed inventory of what a package exports. The extractor reads `package.json#exports`, resolves the backing source files, and returns an `InterfaceModel` that other tools can inspect or render.

## Start from a package root

The simplest path is `extract`:

```ts
import { extract } from '@kitz/paka/__'

const model = extract({
  projectRoot: '/absolute/path/to/package',
})
```

`extract` reads the package from disk. It is the right choice for scripts, local tooling, and semver comparisons.

## Narrow the scope when you need to

If a package exposes multiple entrypoints, you can target the ones you care about:

```ts
import { extract } from '@kitz/paka/__'

const model = extract({
  projectRoot: '/absolute/path/to/package',
  entrypoints: ['./__'],
})
```

That is useful when you want to document or analyze a stable subpath without pulling in the whole package.

## Filter to documented exports

`extract` accepts a `matching` pattern for export filtering. The current CLI prototype uses that to keep only exports with descriptions:

```ts
import { extract } from '@kitz/paka/__'

const model = extract({
  projectRoot: '/absolute/path/to/package',
  matching: {
    docs: {
      description: { $not: undefined },
    },
  },
})
```

Use this when you want docs-oriented output rather than a full structural dump.

## Use in-memory extraction for tests

`extractFromFiles` exists for fixture-driven testing and deterministic analysis without filesystem I/O:

```ts
import { Fs } from '@kitz/fs'
import { extractFromFiles } from '@kitz/paka/__'

const files = Fs.Builder.spec('/pkg')
  .file('package.json', {
    name: 'fixture-pkg',
    exports: { '.': './src/__.js' },
  })
  .file('src/__.ts', 'export const greet = (name: string): string => `hello ${name}`')
  .toLayout()

const model = extractFromFiles({
  projectRoot: '/pkg',
  files,
  extractorVersion: 'test',
})
```

That pattern is what the semver tests in this package use.

## Read the result

In practice, these are the fields you inspect first:

- `model.name`: package name from `package.json`
- `model.entrypoints`: public entrypoints in export-map order
- `entrypoint.module.exports`: exported members for that entrypoint
- `entrypoint.module.docs` and `entrypoint.module.docsProvenance`: attached docs and where they came from
- `export.signatureModel` and `export.location`: normalized signature and source link data

If you are building docs, feed the model into an adaptor. If you are building semver analysis, compare two models instead.
