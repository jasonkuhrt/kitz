---
title: Public API
lucid_generated: true
---

# Public API

This page documents the exported surface of `@kitz/paka` as it exists on this branch.

## Entrypoints

| Entrypoint | Exports |
| --- | --- |
| `@kitz/paka` | `Paka` namespace wrapper |
| `@kitz/paka/__` | Flat extraction, schema, markdown, adaptor, and semver exports |

If you import from `@kitz/paka`, prefix the flat names below with `Paka.`. If you import from `@kitz/paka/__`, use them directly.

## Namespaces

| Export | Purpose |
| --- | --- |
| `Adaptors` | Namespace for output adaptors. Today this is VitePress-oriented. |
| `Extractor` | Namespace for extraction helpers, parsing utilities, and lower-level module analysis. |
| `Semver` | Namespace mirror of the semver surface that is also exported flat. |

## Markdown to JSDoc

| Export | Purpose |
| --- | --- |
| `MarkdownToJsDocMetadata` | Metadata needed to convert markdown into generated JSDoc. |
| `markdownToJsDoc` | Converts a markdown document into TSDoc-style JSDoc output. |

## Semver surface

| Export | Purpose |
| --- | --- |
| `EntrypointKind` | Enum and type describing simple versus drillable-namespace entrypoints. |
| `PublicExportType` | Union of runtime and type-only export kinds. |
| `PublicInterfaceImpact` | Enum and type for the overall impact vocabulary: `none`, `minor`, `major`. |
| `ReleasePhase` | Enum and type for the mapped release phase: `initial` or `public`. |
| `SemverChangeKind` | Enum and type for specific change categories. |
| `PublicExportSelectorSchema`, `PublicExportSelector`, `makePublicExportSelector`, `formatPublicExportSelector` | Stable identifiers for one public export. |
| `PublicExportShapeSchema`, `PublicExportShape`, `makePublicExportShape` | Normalized shape used when comparing exports. |
| `SemverChangeSchema`, `SemverChange`, `makeSemverChange` | Schema and constructor helpers for one change entry. |
| `SemverReportSchema`, `SemverReport`, `makeSemverReport`, `semverReportHasChanges` | Schema and helpers for the full report. |
| `AnalyzeSemverImpactOptions`, `AnalyzeSemverImpactFromProjectRootsOptions` | Configuration types for model-based and root-based comparison. |
| `analyzeSemverImpact` | Compares two extracted `InterfaceModel` values. |
| `analyzeSemverImpactFromProjectRoots` | Extracts two package roots and compares them directly. |
| `renderSemverReport` | Renders a plain-text report from a `SemverReport`. |

## Extractor namespace

`Extractor` re-exports the lower-level extraction modules:

| Export | Purpose |
| --- | --- |
| `ExtractConfig` | Disk-based extraction configuration. |
| `extract` | Extracts an `InterfaceModel` from a package root on disk. |
| `extractFromFiles` | Extracts an `InterfaceModel` from an in-memory filesystem layout. |
| `Category`, `categorize` | Category parsing for exports and docs organization. |
| `extractExport` | Low-level extraction of one exported declaration. |
| `JSDocInfo`, `parseJSDoc` | JSDoc parsing utilities used during extraction. |
| `ModuleExtractionOptions`, `extractModuleFromFile`, `extractModule` | Lower-level module extraction APIs. |

## Adaptors namespace

`Adaptors.VitePress` is the only adaptor namespace exported today.

| Export | Purpose |
| --- | --- |
| `VitePressConfig` | Configuration for VitePress generation. |
| `generate` | Writes VitePress markdown pages and generated sidebar output. |
| `generateSidebar` | Builds sidebar data from an `InterfaceModel`. |

## Schema surface

The schema layer is the canonical vocabulary for extracted interface data.

### Export taxonomy

| Export | Purpose |
| --- | --- |
| `ExportLevel` | Distinguishes runtime values from type-only exports. |
| `ValueExportType` | Runtime export kinds such as function, const, class, and namespace. |
| `TypeExportType` | Type-level export kinds such as interface and type alias. |
| `Export`, `ValueExport`, `TypeExport` | Tagged schemas for individual public exports. |
| `ExportEncoded`, `ValueExportEncoded` | Encoded transport shapes for serialized exports. |

### Docs and provenance

| Export | Purpose |
| --- | --- |
| `Example` | One example extracted from JSDoc. |
| `ImportExample` | Structured import example used for docs rendering. |
| `SourceLocation` | File-and-line source location for exported members. |
| `JSDocProvenance`, `MdFileProvenance`, `Provenance` | Where documentation came from. |
| `Docs`, `DocsProvenance` | Export or module docs plus provenance per field. |
| `Feature`, `BodySection`, `Home`, `ModuleDocs` | Structured landing-page and module-docs content. |

### Signature models

| Export | Purpose |
| --- | --- |
| `BuilderMethodCategory` | Classification for builder methods. |
| `TypeParameter`, `Parameter`, `FunctionSignature` | Low-level function-signature pieces. |
| `FunctionSignatureModel`, `BuilderSignatureModel`, `TypeSignatureModel`, `ValueSignatureModel`, `ClassSignatureModel`, `SignatureModel` | Normalized signature variants used by extracted exports. |
| `BuilderMethod`, `ClassProperty`, `ClassMethod` | Structured members used inside signature models. |

### Package structure

| Export | Purpose |
| --- | --- |
| `Module`, `ModuleEncoded` | One extracted module and its serialized shape. |
| `DrillableNamespaceEntrypoint`, `SimpleEntrypoint`, `Entrypoint` | Entrypoint models describing how a package path is imported. |
| `PackageMetadata`, `Package`, `InterfaceModel` | Package-level model types. |

## Choosing an import style

Use `@kitz/paka` when you want one namespace:

```ts
import { Paka } from '@kitz/paka'

const model = Paka.Extractor.extract({
  projectRoot: '/absolute/path/to/package',
})
```

Use `@kitz/paka/__` when you want direct named imports:

```ts
import { extract, analyzeSemverImpactFromProjectRoots } from '@kitz/paka/__'

const model = extract({ projectRoot: '/absolute/path/to/package' })
const report = analyzeSemverImpactFromProjectRoots({
  previousProjectRoot: '/absolute/path/to/previous-package',
  nextProjectRoot: '/absolute/path/to/next-package',
})
```
