import { Semver } from '@kitz/semver'
import { Schema as S } from 'effect'
import { extract } from './extractor/__.js'
import {
  type Entrypoint,
  ExportLevel,
  type Export as ExtractedExport,
  type InterfaceModel,
  type Module,
  type SignatureModel as ExtractedSignatureModel,
  TypeExportType,
  ValueExportType,
} from './schema.js'

/**
 * Entry point import shape exposed by the package.
 */
export const EntrypointKind = S.Enum({
  simple: 'simple',
  drillableNamespace: 'drillable-namespace',
} as const)
export type EntrypointKind = typeof EntrypointKind.Type

/**
 * Public export type exposed by a module.
 */
export const PublicExportType = S.Union([ValueExportType, TypeExportType])
export type PublicExportType = typeof PublicExportType.Type

/**
 * Impact level that can be inferred from public-interface changes alone.
 *
 * `patch` is intentionally excluded because implementation-only fixes are not visible from a
 * public export diff.
 */
export const PublicInterfaceImpact = S.Enum({
  none: 'none',
  minor: 'minor',
  major: 'major',
} as const)
export type PublicInterfaceImpact = typeof PublicInterfaceImpact.Type

/**
 * Release phase used for phase-aware semver mapping.
 */
export const ReleasePhase = S.Enum({
  initial: 'initial',
  public: 'public',
} as const)
export type ReleasePhase = typeof ReleasePhase.Type

/**
 * Specific kind of public-interface change.
 */
export const SemverChangeKind = S.Enum({
  entrypointAdded: 'entrypoint-added',
  entrypointRemoved: 'entrypoint-removed',
  entrypointChanged: 'entrypoint-changed',
  exportAdded: 'export-added',
  exportRemoved: 'export-removed',
  exportChanged: 'export-changed',
} as const)
export type SemverChangeKind = typeof SemverChangeKind.Type

/**
 * Stable selector for a public export.
 */
export const PublicExportSelectorSchema = S.Struct({
  /** Package export path from `package.json#exports`. */
  entrypoint: S.String,
  /** Nested namespace path plus terminal export name. */
  path: S.Array(S.String),
}).annotate({
  identifier: 'PublicExportSelector',
  title: 'Public Export Selector',
  description: 'Stable selector for a public export.',
})
export type PublicExportSelector = typeof PublicExportSelectorSchema.Type

/**
 * Construct a stable selector for a public export.
 */
export const makePublicExportSelector = (params: PublicExportSelector): PublicExportSelector =>
  params

/**
 * Stable human-readable identifier for a public export selector.
 */
export const formatPublicExportSelector = (selector: PublicExportSelector): string =>
  selector.path.length === 0
    ? selector.entrypoint
    : `${selector.entrypoint}:${selector.path.join('.')}`

/**
 * Simplified public export surface used for semver comparison.
 */
export const PublicExportShapeSchema = S.Struct({
  /** Whether the export exists at runtime or only in the type system. */
  level: ExportLevel,
  /** Specific export construct kind. */
  type: PublicExportType,
  /** Canonical signature rendering used for change detection. */
  signature: S.String,
}).annotate({
  identifier: 'PublicExportShape',
  title: 'Public Export Shape',
  description: 'Simplified public export surface used for semver comparison.',
})
export type PublicExportShape = typeof PublicExportShapeSchema.Type

/**
 * Construct a simplified public export surface.
 */
export const makePublicExportShape = (params: PublicExportShape): PublicExportShape => params

/**
 * Structured public-interface change.
 */
export const SemverChangeSchema = S.Struct({
  /** Specific change kind. */
  kind: SemverChangeKind,
  /** Public-interface impact contributed by this change. */
  impact: PublicInterfaceImpact,
  /** Stable selector of the changed public surface. */
  selector: PublicExportSelectorSchema,
  /** Previous surface shape, when one existed. */
  previous: S.optional(PublicExportShapeSchema),
  /** Next surface shape, when one exists. */
  next: S.optional(PublicExportShapeSchema),
  /** Human-readable summary. */
  note: S.String,
}).annotate({
  identifier: 'SemverChange',
  title: 'Semver Change',
  description: 'Structured public-interface change.',
})
export type SemverChange = typeof SemverChangeSchema.Type

/**
 * Construct a structured public-interface change.
 */
export const makeSemverChange = (params: SemverChange): SemverChange => params

/**
 * Full semver analysis report for a public-interface diff.
 */
export const SemverReportSchema = S.Struct({
  /** Highest impact implied by the public export diff. */
  impact: PublicInterfaceImpact,
  /** Phase-aware release bump, when a current version was provided. */
  releaseBump: S.optional(Semver.BumpType),
  /** Current version used for phase-aware mapping. */
  currentVersion: S.optional(S.String),
  /** Next version computed from the mapped release bump. */
  nextVersion: S.optional(S.String),
  /** Release phase of the provided current version. */
  releasePhase: S.optional(ReleasePhase),
  /** Detailed public-interface changes. */
  changes: S.Array(SemverChangeSchema),
}).annotate({
  identifier: 'SemverReport',
  title: 'Semver Report',
  description: 'Full semver analysis report for a public-interface diff.',
})
export type SemverReport = typeof SemverReportSchema.Type

/**
 * Construct a full semver analysis report.
 */
export const makeSemverReport = (params: SemverReport): SemverReport => params

/**
 * Whether any public export changes were observed.
 */
export const semverReportHasChanges = (report: SemverReport): boolean => report.impact !== 'none'

/**
 * Configuration for comparing two extracted interface models.
 */
export interface AnalyzeSemverImpactOptions {
  readonly previous: InterfaceModel
  readonly next: InterfaceModel
  readonly currentVersion?: string | Semver.Semver
}

/**
 * Configuration for comparing two package roots directly from disk.
 */
export interface AnalyzeSemverImpactFromProjectRootsOptions {
  readonly previousProjectRoot: string
  readonly nextProjectRoot: string
  readonly currentVersion?: string | Semver.Semver
}

const impactPriority: Record<PublicInterfaceImpact, number> = {
  major: 2,
  minor: 1,
  none: 0,
}

const getEntrypointKind = (entrypoint: Entrypoint): EntrypointKind =>
  entrypoint._tag === 'DrillableNamespaceEntrypoint' ? 'drillable-namespace' : 'simple'

const renderTypeParameters = (
  typeParameters: ReadonlyArray<{
    readonly name: string
    readonly constraint?: string | undefined
    readonly default?: string | undefined
  }>,
): string => {
  if (typeParameters.length === 0) return ''

  const rendered = typeParameters.map((typeParameter) => {
    const constraint = typeParameter.constraint ? ` extends ${typeParameter.constraint}` : ''
    const defaultValue = typeParameter.default ? ` = ${typeParameter.default}` : ''
    return `${typeParameter.name}${constraint}${defaultValue}`
  })

  return `<${rendered.join(', ')}>`
}

const renderParameters = (
  parameters: ReadonlyArray<{
    readonly name: string
    readonly type: string
    readonly optional: boolean
    readonly rest: boolean
    readonly defaultValue?: string | undefined
  }>,
): string =>
  parameters
    .map((parameter) => {
      const rest = parameter.rest ? '...' : ''
      const optional = parameter.optional ? '?' : ''
      const defaultValue = parameter.defaultValue ? ` = ${parameter.defaultValue}` : ''
      return `${rest}${parameter.name}${optional}: ${parameter.type}${defaultValue}`
    })
    .join(', ')

const renderFunctionSignature = (signature: {
  readonly typeParameters: ReadonlyArray<{
    readonly name: string
    readonly constraint?: string | undefined
    readonly default?: string | undefined
  }>
  readonly parameters: ReadonlyArray<{
    readonly name: string
    readonly type: string
    readonly optional: boolean
    readonly rest: boolean
    readonly defaultValue?: string | undefined
  }>
  readonly returnType: string
}): string =>
  `${renderTypeParameters(signature.typeParameters)}(${renderParameters(signature.parameters)}) => ${signature.returnType}`

const renderBuilderMethods = (
  category: string,
  methods: ReadonlyArray<{
    readonly name: string
    readonly overloads: ReadonlyArray<{
      readonly typeParameters: ReadonlyArray<{
        readonly name: string
        readonly constraint?: string | undefined
        readonly default?: string | undefined
      }>
      readonly parameters: ReadonlyArray<{
        readonly name: string
        readonly type: string
        readonly optional: boolean
        readonly rest: boolean
        readonly defaultValue?: string | undefined
      }>
      readonly returnType: string
    }>
    readonly transformsTo?: string | undefined
  }>,
): string => {
  if (methods.length === 0) return `${category}: []`

  const rendered = methods.map((method) => {
    const overloads = method.overloads.map(renderFunctionSignature).join(' | ')
    const transformsTo = method.transformsTo ? ` -> ${method.transformsTo}` : ''
    return `${method.name}${transformsTo}: ${overloads}`
  })

  return `${category}: [${rendered.join('; ')}]`
}

const renderSignatureModel = (signature: ExtractedSignatureModel): string => {
  switch (signature._tag) {
    case 'FunctionSignatureModel':
      return signature.overloads.map(renderFunctionSignature).join(' | ')
    case 'BuilderSignatureModel':
      return [
        `builder ${signature.typeName}`,
        `entry: ${renderFunctionSignature(signature.entryPoint)}`,
        renderBuilderMethods('chainable', signature.chainableMethods),
        renderBuilderMethods('terminal', signature.terminalMethods),
        renderBuilderMethods('transform', signature.transformMethods),
      ].join(' | ')
    case 'ClassSignatureModel': {
      const ctor = signature.ctor ? `ctor ${renderFunctionSignature(signature.ctor)}` : 'ctor ()'
      const properties =
        signature.properties.length === 0
          ? 'properties: []'
          : `properties: [${signature.properties
              .map((property) => {
                const modifiers = [
                  property.static ? 'static' : undefined,
                  property.readonly ? 'readonly' : undefined,
                ]
                  .filter((value): value is string => value !== undefined)
                  .join(' ')
                const prefix = modifiers.length > 0 ? `${modifiers} ` : ''
                const optional = property.optional ? '?' : ''
                return `${prefix}${property.name}${optional}: ${property.type}`
              })
              .join('; ')}]`
      const methods =
        signature.methods.length === 0
          ? 'methods: []'
          : `methods: [${signature.methods
              .map((method) => {
                const prefix = method.static ? 'static ' : ''
                return `${prefix}${method.name}: ${method.overloads
                  .map(renderFunctionSignature)
                  .join(' | ')}`
              })
              .join('; ')}]`
      return `${ctor} | ${properties} | ${methods}`
    }
    case 'TypeSignatureModel':
      return normalizeText(signature.text)
    case 'ValueSignatureModel':
      return normalizeText(signature.type)
  }
}

const normalizeText = (value: string): string => value.replace(/\s+/g, ' ').trim()

const toExportShape = (export_: ExtractedExport): PublicExportShape =>
  makePublicExportShape({
    level: export_._tag,
    type: export_.type,
    signature: renderSignatureModel(export_.signatureSimple ?? export_.signature),
  })

const compareExportShapes = (
  selector: PublicExportSelector,
  previous: PublicExportShape,
  next: PublicExportShape,
): SemverChange | undefined => {
  if (previous.level !== next.level || previous.type !== next.type) {
    return makeSemverChange({
      kind: 'export-changed',
      impact: 'major',
      selector,
      previous,
      next,
      note:
        `Changed public export ${formatPublicExportSelector(selector)} from ${previous.level} ${previous.type} ` +
        `to ${next.level} ${next.type}.`,
    })
  }

  if (previous.signature !== next.signature) {
    return makeSemverChange({
      kind: 'export-changed',
      impact: 'major',
      selector,
      previous,
      next,
      note: `Changed public signature of ${formatPublicExportSelector(selector)}.`,
    })
  }

  return undefined
}

const compareModules = (
  entrypoint: string,
  parentPath: ReadonlyArray<string>,
  previous: Module,
  next: Module,
): SemverChange[] => {
  const changes: SemverChange[] = []
  const previousExports = new Map(previous.exports.map((export_) => [export_.name, export_]))
  const nextExports = new Map(next.exports.map((export_) => [export_.name, export_]))
  const exportNames = [...new Set([...previousExports.keys(), ...nextExports.keys()])].toSorted()

  for (const exportName of exportNames) {
    const previousExport = previousExports.get(exportName)
    const nextExport = nextExports.get(exportName)
    const selector = makePublicExportSelector({
      entrypoint,
      path: [...parentPath, exportName],
    })

    if (!previousExport && nextExport) {
      changes.push(
        makeSemverChange({
          kind: 'export-added',
          impact: 'minor',
          selector,
          next: toExportShape(nextExport),
          note: `Added public export ${formatPublicExportSelector(selector)}.`,
        }),
      )
      continue
    }

    if (previousExport && !nextExport) {
      changes.push(
        makeSemverChange({
          kind: 'export-removed',
          impact: 'major',
          selector,
          previous: toExportShape(previousExport),
          note: `Removed public export ${formatPublicExportSelector(selector)}.`,
        }),
      )
      continue
    }

    if (!previousExport || !nextExport) continue

    const previousShape = toExportShape(previousExport)
    const nextShape = toExportShape(nextExport)
    const exportShapeChange = compareExportShapes(selector, previousShape, nextShape)

    if (exportShapeChange) {
      changes.push(exportShapeChange)
      continue
    }

    if (
      previousExport._tag === 'value' &&
      previousExport.type === 'namespace' &&
      previousExport.module &&
      nextExport._tag === 'value' &&
      nextExport.type === 'namespace' &&
      nextExport.module
    ) {
      changes.push(
        ...compareModules(
          entrypoint,
          [...parentPath, exportName],
          previousExport.module,
          nextExport.module,
        ),
      )
    }
  }

  return changes
}

const resolveImpact = (changes: ReadonlyArray<SemverChange>): PublicInterfaceImpact =>
  changes.reduce<PublicInterfaceImpact>(
    (current, change) =>
      impactPriority[change.impact] > impactPriority[current] ? change.impact : current,
    'none',
  )

const parseCurrentVersion = (value: string | Semver.Semver): Semver.Semver =>
  typeof value === 'string' ? Semver.fromString(value) : value

const getReleasePhase = (version: Semver.Semver): ReleasePhase =>
  Semver.isPhaseInitial(version) ? 'initial' : 'public'

/**
 * Analyze the public semver impact between two extracted interface models.
 *
 * The analysis is intentionally conservative:
 * - added entrypoints and exports are minor
 * - removed entrypoints and exports are major
 * - changed export shapes or signatures are major
 */
export const analyzeSemverImpact = (params: AnalyzeSemverImpactOptions): SemverReport => {
  if (params.previous.name !== params.next.name) {
    throw new Error(
      `Cannot compare different packages: ${params.previous.name} !== ${params.next.name}`,
    )
  }

  const changes: SemverChange[] = []
  const previousEntrypoints = new Map(
    params.previous.entrypoints.map((entrypoint) => [entrypoint.path, entrypoint]),
  )
  const nextEntrypoints = new Map(
    params.next.entrypoints.map((entrypoint) => [entrypoint.path, entrypoint]),
  )
  const entrypointPaths = [
    ...new Set([...previousEntrypoints.keys(), ...nextEntrypoints.keys()]),
  ].toSorted()

  for (const entrypointPath of entrypointPaths) {
    const previousEntrypoint = previousEntrypoints.get(entrypointPath)
    const nextEntrypoint = nextEntrypoints.get(entrypointPath)

    if (!previousEntrypoint && nextEntrypoint) {
      changes.push(
        makeSemverChange({
          kind: 'entrypoint-added',
          impact: 'minor',
          selector: makePublicExportSelector({ entrypoint: entrypointPath, path: [] }),
          note: `Added public entrypoint ${entrypointPath}.`,
        }),
      )
      continue
    }

    if (previousEntrypoint && !nextEntrypoint) {
      changes.push(
        makeSemverChange({
          kind: 'entrypoint-removed',
          impact: 'major',
          selector: makePublicExportSelector({ entrypoint: entrypointPath, path: [] }),
          note: `Removed public entrypoint ${entrypointPath}.`,
        }),
      )
      continue
    }

    if (!previousEntrypoint || !nextEntrypoint) continue

    const previousKind = getEntrypointKind(previousEntrypoint)
    const nextKind = getEntrypointKind(nextEntrypoint)

    if (previousKind !== nextKind) {
      changes.push(
        makeSemverChange({
          kind: 'entrypoint-changed',
          impact: 'major',
          selector: makePublicExportSelector({ entrypoint: entrypointPath, path: [] }),
          note:
            `Changed entrypoint ${entrypointPath} import shape from ${previousKind} ` +
            `to ${nextKind}.`,
        }),
      )
      continue
    }

    changes.push(
      ...compareModules(entrypointPath, [], previousEntrypoint.module, nextEntrypoint.module),
    )
  }

  const sortedChanges = changes.toSorted(
    (left, right) =>
      impactPriority[right.impact] - impactPriority[left.impact] ||
      formatPublicExportSelector(left.selector).localeCompare(
        formatPublicExportSelector(right.selector),
      ),
  )
  const impact = resolveImpact(sortedChanges)

  if (!params.currentVersion) {
    return makeSemverReport({
      impact,
      changes: sortedChanges,
    })
  }

  const currentVersion = parseCurrentVersion(params.currentVersion)
  const releasePhase = getReleasePhase(currentVersion)
  const releaseBump = impact === 'none' ? undefined : Semver.mapBumpForPhase(currentVersion, impact)
  const nextVersion =
    releaseBump === undefined ? undefined : Semver.increment(currentVersion, releaseBump).toString()

  return makeSemverReport({
    impact,
    releaseBump,
    currentVersion: currentVersion.toString(),
    nextVersion,
    releasePhase,
    changes: sortedChanges,
  })
}

/**
 * Analyze the public semver impact between two package roots on disk.
 */
export const analyzeSemverImpactFromProjectRoots = (
  params: AnalyzeSemverImpactFromProjectRootsOptions,
): SemverReport =>
  analyzeSemverImpact({
    previous: extract({ projectRoot: params.previousProjectRoot }),
    next: extract({ projectRoot: params.nextProjectRoot }),
    ...(params.currentVersion !== undefined ? { currentVersion: params.currentVersion } : {}),
  })

/**
 * Render a semver report as readable plain text.
 */
export const renderSemverReport = (report: SemverReport): string => {
  const lines = [`Public interface impact: ${report.impact}`]

  if (report.currentVersion) {
    lines.push(`Current version: ${report.currentVersion}`)
  }

  if (report.releasePhase) {
    lines.push(`Release phase: ${report.releasePhase}`)
  }

  if (report.releaseBump) {
    lines.push(`Release bump: ${report.releaseBump}`)
  }

  if (report.nextVersion) {
    lines.push(`Next version: ${report.nextVersion}`)
  }

  if (report.changes.length === 0) {
    lines.push(`No public export changes detected.`)
    return lines.join('\n')
  }

  lines.push('Changes:')
  for (const change of report.changes) {
    lines.push(`- [${change.impact}] ${change.note}`)
  }

  return lines.join('\n')
}
