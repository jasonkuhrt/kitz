#!/usr/bin/env bun
/**
 * Generate type-level test namespace files with ESM exports.
 *
 * Creates ~40 files with full JSDoc for each matcher combination.
 * Limited to 1 extractor depth to avoid combinatorial explosion.
 *
 * Optimizes for:
 * 1. Quality JSDoc for inline user help
 * 2. TypeScript compiler performance (direct definitions)
 * 3. Maintainability (single source of truth)
 *
 * Run from packages/assert directory:
 *   bun run generate
 */

import { FileSystem, Path as PlatformPath } from '@effect/platform'
import { Platform } from '@kitz/platform'
import { Effect, Either, pipe } from 'effect'
import { Project } from 'ts-morph'

const pathApi = Effect.runSync(PlatformPath.Path.pipe(Effect.provide(Platform.Path.layer)))

const basename = (targetPath: string): string => pathApi.basename(targetPath)
const dirname = (targetPath: string): string => pathApi.dirname(targetPath)
const join = (...parts: ReadonlyArray<string>): string => pathApi.join(...parts)
const relative = (fromPath: string, toPath: string): string => pathApi.relative(fromPath, toPath)
const pathExists = (targetPath: string) =>
  Effect.flatMap(FileSystem.FileSystem, (fileSystem) => fileSystem.exists(targetPath))
const ensureDirectory = (targetPath: string) =>
  Effect.flatMap(FileSystem.FileSystem, (fileSystem) =>
    fileSystem.makeDirectory(targetPath, { recursive: true }),
  )
const writeFileString = (targetPath: string, content: string) =>
  Effect.flatMap(FileSystem.FileSystem, (fileSystem) =>
    fileSystem.writeFileString(targetPath, content),
  )

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ Data Structures

interface Matcher {
  name: string // e.g., 'string'
  typeExpr: string // e.g., 'string'
  description: string
}

interface Extractor {
  name: string // e.g., 'awaited'
  kindName: string // e.g., 'Awaited$'
  description: string
  inputDesc: string // e.g., 'Promise<T>'
  outputDesc: string // e.g., 'T'
}

interface Relator {
  name: string // e.g., 'exact'
  kindName: string // e.g., 'ExactKind'
  description: string
  passExample: string
  failExample: string
}

interface Combination {
  extractors: Extractor[]
  relator: Relator
  negated: boolean
  outputPath: string
  isBarrel: boolean
}

type GenerateBuilderError =
  | { _tag: 'RegistryFileNotFound'; registryFilePath: string }
  | { _tag: 'LensRegistryInterfaceMissing'; registryFilePath: string }
  | { _tag: 'ExtractorPropertyMissingTypeAnnotation'; extractorName: string }
  | { _tag: 'MissingExtractorMetadata'; missingMetadata: readonly string[] }
  | { _tag: 'ExtractorMissingMetadata'; extractorName: string }

const formatGenerateBuilderError = (error: GenerateBuilderError): string => {
  switch (error._tag) {
    case 'RegistryFileNotFound':
      return `Registry file not found: ${error.registryFilePath}`
    case 'LensRegistryInterfaceMissing':
      return `LensRegistry interface not found in registry file: ${error.registryFilePath}`
    case 'ExtractorPropertyMissingTypeAnnotation':
      return `Extractor property has no type annotation: ${error.extractorName}`
    case 'MissingExtractorMetadata':
      return (
        `Extractors in registry missing metadata: ${error.missingMetadata.join(', ')}\n` +
        `Add metadata for these extractors in EXTRACTOR_METADATA constant.`
      )
    case 'ExtractorMissingMetadata':
      return `Extractor '${error.extractorName}' is in registry but has no metadata`
  }
}

const fromEither = <A, E>(value: Either.Either<A, E>) =>
  Either.isLeft(value) ? Effect.fail(value.left) : Effect.succeed(value.right)

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ Constants

const MATCHERS: Matcher[] = [
  { name: 'of', typeExpr: '$Expected', description: 'any expected type' },
  { name: 'string', typeExpr: 'string', description: 'string' },
  { name: 'number', typeExpr: 'number', description: 'number' },
  { name: 'bigint', typeExpr: 'bigint', description: 'bigint' },
  { name: 'boolean', typeExpr: 'boolean', description: 'boolean' },
  { name: 'true', typeExpr: 'true', description: 'true' },
  { name: 'false', typeExpr: 'false', description: 'false' },
  { name: 'undefined', typeExpr: 'undefined', description: 'undefined' },
  { name: 'null', typeExpr: 'null', description: 'null' },
  { name: 'symbol', typeExpr: 'symbol', description: 'symbol' },
  { name: 'Date', typeExpr: 'Date', description: 'Date' },
  { name: 'RegExp', typeExpr: 'RegExp', description: 'RegExp' },
  { name: 'Error', typeExpr: 'Error', description: 'Error' },
  { name: 'unknown', typeExpr: 'unknown', description: 'unknown' },
  { name: 'any', typeExpr: 'any', description: 'any' },
  { name: 'never', typeExpr: 'never', description: 'never' },
]

/**
 * Extractor metadata (descriptions for JSDoc generation).
 * The list of extractors comes from the registry - this only provides documentation.
 */
const EXTRACTOR_METADATA: Record<
  string,
  { description: string; inputDesc: string; outputDesc: string }
> = {
  awaited: {
    description: 'extracts the resolved type from a Promise',
    inputDesc: 'Promise<T>',
    outputDesc: 'T',
  },
  returned: {
    description: 'extracts the return type from a function',
    inputDesc: '(...args: any[]) => T',
    outputDesc: 'T',
  },
  array: {
    description: 'extracts the element type from an array',
    inputDesc: 'T[]',
    outputDesc: 'T',
  },
  parameters: {
    description: 'extracts the parameters tuple from a function',
    inputDesc: '(...args: any[]) => T',
    outputDesc: 'Parameters<Function>',
  },
  parameter1: {
    description: 'extracts the first parameter type from a function',
    inputDesc: '(p1: T, ...) => any',
    outputDesc: 'T',
  },
  parameter2: {
    description: 'extracts the second parameter type from a function',
    inputDesc: '(p1: any, p2: T, ...) => any',
    outputDesc: 'T',
  },
  parameter3: {
    description: 'extracts the third parameter type from a function',
    inputDesc: '(p1: any, p2: any, p3: T, ...) => any',
    outputDesc: 'T',
  },
  parameter4: {
    description: 'extracts the fourth parameter type from a function',
    inputDesc: '(p1: any, p2: any, p3: any, p4: T, ...) => any',
    outputDesc: 'T',
  },
  parameter5: {
    description: 'extracts the fifth parameter type from a function',
    inputDesc: '(p1: any, p2: any, p3: any, p4: any, p5: T) => any',
    outputDesc: 'T',
  },
}

const RELATORS: Record<string, Relator> = {
  exact: {
    name: 'exact',
    kindName: 'AssertExactKind',
    description: 'exact structural equality',
    passExample: 'string extends string',
    failExample: '"hello" not exact match for string',
  },
  equiv: {
    name: 'equiv',
    kindName: 'AssertEquivKind',
    description: 'mutual assignability (equivalent types)',
    passExample: 'string & {} ≡ string',
    failExample: 'string not equivalent to number',
  },
  sub: {
    name: 'sub',
    kindName: 'AssertSubKind',
    description: 'subtype relation (extends)',
    passExample: '"hello" extends string',
    failExample: 'string does not extend "hello"',
  },
}

const RELATOR_VALUES = Object.values(RELATORS)

interface UnaryRelator {
  name: string
  kindName: string
  description: string
  passExample: string
  failExample: string
}

const UNARY_RELATORS: Record<string, UnaryRelator> = {
  any: {
    name: 'any',
    kindName: 'AssertAnyKind',
    description: 'asserts type is `any`',
    passExample: 'type _ = Assert.any<any>',
    failExample: 'type _ = Assert.any<string>',
  },
  unknown: {
    name: 'unknown',
    kindName: 'AssertUnknownKind',
    description: 'asserts type is `unknown`',
    passExample: 'type _ = Assert.unknown<unknown>',
    failExample: 'type _ = Assert.unknown<string>',
  },
  never: {
    name: 'never',
    kindName: 'AssertNeverKind',
    description: 'asserts type is `never`',
    passExample: 'type _ = Assert.never<never>',
    failExample: 'type _ = Assert.never<string>',
  },
  empty: {
    name: 'empty',
    kindName: 'AssertEmptyKind',
    description: "asserts type is empty (`[]`, `''`, or `Record<PropertyKey, never>`)",
    passExample: 'type _ = Assert.empty<[]>',
    failExample: 'type _ = Assert.empty<[1]>',
  },
}

// Monorepo paths - run from packages/assert
const PACKAGE_DIR = process.cwd()
const OUTPUT_DIR = join(PACKAGE_DIR, 'src/builder-generated')
const CORE_PACKAGE_DIR = join(PACKAGE_DIR, '../core')

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ Registry Loading

/**
 * Load extractor registry from TypeScript source using ts-morph.
 * Returns a map of extractor names to their Kind interface names.
 */
const loadExtractorRegistry = () =>
  Effect.gen(function* () {
    const registryFilePath = join(CORE_PACKAGE_DIR, 'src/optic/registry.ts')
    const registryFileExists = yield* pathExists(registryFilePath)
    if (!registryFileExists) {
      return yield* Effect.fail({ _tag: 'RegistryFileNotFound', registryFilePath })
    }

    const project = new Project({
      tsConfigFilePath: join(PACKAGE_DIR, 'tsconfig.json'),
    })
    const sourceFile = project.addSourceFileAtPath(registryFilePath)

    const registryInterface = sourceFile.getInterface('LensRegistry')
    if (!registryInterface) {
      return yield* Effect.fail({ _tag: 'LensRegistryInterfaceMissing', registryFilePath })
    }

    const registry: Record<string, string> = {}
    for (const property of registryInterface.getProperties()) {
      const extractorName = property.getName()
      const typeNode = property.getTypeNode()

      if (!typeNode) {
        return yield* Effect.fail({ _tag: 'ExtractorPropertyMissingTypeAnnotation', extractorName })
      }

      registry[extractorName] = typeNode.getText()
    }

    return registry
  })

/**
 * Validate that extractor metadata covers all registry entries.
 * Returns Left if metadata is missing for any registry entry.
 */
function validateExtractorMetadata(
  registry: Record<string, string>,
): Either.Either<GenerateBuilderError, { readonly unusedMetadata: ReadonlyArray<string> }> {
  const registryNames = Object.keys(registry).sort()
  const metadataNames = Object.keys(EXTRACTOR_METADATA).sort()

  const missingMetadata = registryNames.filter((name) => !(name in EXTRACTOR_METADATA))
  if (missingMetadata.length > 0) {
    return Either.left({ _tag: 'MissingExtractorMetadata', missingMetadata })
  }

  const unusedMetadata = metadataNames.filter((name) => !(name in registry))
  return Either.right({ unusedMetadata })
}

/**
 * Build EXTRACTORS from registry + metadata.
 * This ensures the registry is the source of truth for which extractors exist.
 */
function buildExtractors(
  registry: Record<string, string>,
): Either.Either<GenerateBuilderError, Record<string, Extractor>> {
  const extractors: Record<string, Extractor> = {}
  for (const [name, kindName] of Object.entries(registry)) {
    const metadata = EXTRACTOR_METADATA[name]
    if (!metadata) {
      return Either.left({ _tag: 'ExtractorMissingMetadata', extractorName: name })
    }
    extractors[name] = {
      name,
      kindName,
      description: metadata.description,
      inputDesc: metadata.inputDesc,
      outputDesc: metadata.outputDesc,
    }
  }
  return Either.right(extractors)
}

const setupExtractors = pipe(
  loadExtractorRegistry(),
  Effect.flatMap((registry) =>
    pipe(
      validateExtractorMetadata(registry),
      fromEither,
      Effect.tap(({ unusedMetadata }) =>
        unusedMetadata.length > 0
          ? Effect.logWarning(`Unused extractor metadata entries: ${unusedMetadata.join(', ')}`)
          : Effect.void,
      ),
      Effect.map(() => registry),
    ),
  ),
  Effect.flatMap((registry) => fromEither(buildExtractors(registry))),
)

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ Path Utilities

function getRelativePath(from: string, to: string): string {
  const rel = relative(dirname(from), to)
  // Ensure .js extension and proper ./ prefix
  return rel.startsWith('.') ? rel : `./${rel}`
}

function calculateImportPaths(combo: Combination) {
  // Calculate proper relative paths from source to target files
  const sourceFile = combo.outputPath
  const srcDir = join(PACKAGE_DIR, 'src')

  const relatorsPath = getRelativePath(sourceFile, join(srcDir, 'asserts.js'))
  const builderPath = getRelativePath(sourceFile, join(srcDir, 'builder-singleton.js'))

  return { relatorsPath, builderPath }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ Template Generation

function generateFileHeader(combo: Combination): string {
  const { relatorsPath, builderPath } = calculateImportPaths(combo)

  const extractorImports = combo.extractors.length > 0 ? `import { Optic } from '@kitz/core'\n` : ''

  const eitherImport = combo.extractors.length > 0 ? `import type { Either } from 'effect'\n` : ''

  // Add noExcess kinds for sub/equiv
  const relatorKinds = [combo.relator.kindName]
  if (!combo.negated && combo.relator.name === 'sub') {
    relatorKinds.push('AssertSubNoExcessKind')
  } else if (!combo.negated && combo.relator.name === 'equiv') {
    relatorKinds.push('AssertEquivNoExcessKind')
  }

  return `import type { Fn } from '@kitz/core'
${extractorImports}${eitherImport}import type { ${relatorKinds.join(', ')} } from '${relatorsPath}'
import { builder } from '${builderPath}'
`
}

function generateFileLevelJSDoc(combo: Combination): string {
  const extractorChain =
    combo.extractors.length > 0
      ? combo.extractors.map((e) => e.description).join(', then ')
      : 'no extraction'

  const extractorNames =
    combo.extractors.length > 0 ? combo.extractors.map((e) => e.name).join(' + ') : 'base'

  return `
/**
 * ${extractorNames} + ${combo.relator.name} relation matchers.
 *
 * ${combo.extractors.length > 0 ? `Extraction: ${extractorChain}` : 'Direct type assertion'}
 * Relation: ${combo.relator.description}
 */
`
}

/**
 * Convert HKT kind name to direct type name.
 * e.g., "Awaited.$Get" → "Awaited.Get"
 */
function kindToDirectType(kindName: string): string {
  return kindName.replace('.$Get', '.Get')
}

function buildExtractorChain(extractors: Extractor[], actualType: string): string {
  if (extractors.length === 0) return actualType

  // Use direct type application instead of HKT
  // e.g., Optic.Awaited.Get<$Actual> instead of Fn.Kind.Apply<Optic.Awaited.$Get, [$Actual]>
  return extractors.reduce(
    (inner, extractor) => `Optic.${kindToDirectType(extractor.kindName)}<${inner}>`,
    actualType,
  )
}

function buildRuntimeChain(combo: Combination, matcherName: string): string {
  // Build the builder access chain: builder.${extractors}.${not?}.${relator}.${matcher}
  const parts = ['builder', ...combo.extractors.map((e) => e.name)]

  // Insert 'not' before relator if negated
  if (combo.negated) {
    parts.push('not')
  }

  parts.push(combo.relator.name, matcherName)

  return parts.join('.')
}

function typedBuilderConst(name: string, runtimeChain: string, exported = false): string {
  const declaration = exported ? 'export const' : 'const'
  return `${declaration} ${name}: typeof ${runtimeChain} = ${runtimeChain}`
}

function generateMatcherJSDoc(matcher: Matcher, combo: Combination): string {
  const extractorChain =
    combo.extractors.length > 0
      ? `\n * Extraction chain: ${combo.extractors.map((e) => `${e.inputDesc} → ${e.outputDesc}`).join(' → ')}`
      : ''

  const matcherDesc =
    matcher.name === 'of'
      ? 'Base matcher accepting any expected type'
      : `Pre-curried matcher for ${matcher.description}`

  // For 'of', add note about type-level shorthand
  const typeShorthandNote =
    matcher.name === 'of'
      ? `\n *\n * Note: This exists for symmetry with the value-level API.\n * At the type-level, you can omit \`.of\` for simpler syntax (e.g., \`${combo.relator.name}<E, A>\` instead of \`${combo.relator.name}.of<E, A>\`).`
      : ''

  // Generate example type for this specific combination
  const exampleType = generateExampleType(matcher, combo)

  return `
/**
 * ${matcherDesc}.${extractorChain}${typeShorthandNote}
 *
 * @example
 * \`\`\`typescript
 * // ✓ Pass
 * type _ = ${exampleType.pass}
 *
 * // ✗ Fail
 * type _ = ${exampleType.fail}
 * \`\`\`
 */`
}

function generateExampleType(matcher: Matcher, combo: Combination): { pass: string; fail: string } {
  const prefix = ['Assert', ...combo.extractors.map((e) => e.name), combo.relator.name].join('.')

  if (matcher.name === 'of') {
    // For 'of', show generic example
    const passActual = buildExampleActual(combo.extractors, 'string')
    const failActual = buildExampleActual(combo.extractors, 'number')
    return {
      pass: `${prefix}.of<string, ${passActual}>`,
      fail: `${prefix}.of<string, ${failActual}>`,
    }
  }

  // For pre-curried matchers
  const passActual = buildExampleActual(combo.extractors, matcher.typeExpr)
  const failActual = buildExampleActual(
    combo.extractors,
    matcher.typeExpr === 'string' ? 'number' : 'string',
  )

  return {
    pass: `${prefix}.${matcher.name}<${passActual}>`,
    fail: `${prefix}.${matcher.name}<${failActual}>`,
  }
}

function buildExampleActual(extractors: Extractor[], innerType: string): string {
  return extractors.reduceRight((inner, extractor) => {
    if (extractor.name === 'awaited') return `Promise<${inner}>`
    if (extractor.name === 'returned') return `() => ${inner}`
    if (extractor.name === 'array') return `${inner}[]`
    if (extractor.name === 'parameters') return `(...args: any[]) => ${inner}`
    if (extractor.name.startsWith('parameter')) return `(arg: ${inner}) => any`
    return inner
  }, innerType)
}

function generateMatcherType(matcher: Matcher, combo: Combination): string {
  const extractorChain = buildExtractorChain(combo.extractors, '$Actual')

  const expectedType = matcher.name === 'of' ? '$Expected' : matcher.typeExpr
  const negatedParam = combo.negated ? ', true' : ''

  let typeDef: string
  if (combo.extractors.length > 0) {
    // Inline Either unwrapping with intermediate type parameter
    const typeParams =
      matcher.name === 'of'
        ? '<$Expected, $Actual, __$ActualExtracted = ' + extractorChain + '>'
        : '<$Actual, __$ActualExtracted = ' + extractorChain + '>'

    typeDef = `// oxfmt-ignore\ntype ${matcher.name}_${typeParams} =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<${combo.relator.kindName}, [${expectedType}, __actual__${negatedParam}]>
                                                                         : never`
  } else {
    // No extractors - direct application
    const typeParams = matcher.name === 'of' ? '<$Expected, $Actual>' : '<$Actual>'
    typeDef = `type ${matcher.name}_${typeParams} = Fn.Kind.Apply<${combo.relator.kindName}, [${expectedType}, $Actual${negatedParam}]>`
  }

  // Pre-configured matchers are already functions in BuilderMatchers interface
  // No need to chain .on - they're accessed directly from builder
  const runtimeChain = buildRuntimeChain(combo, matcher.name)
  const constDef = typedBuilderConst(`${matcher.name}_`, runtimeChain)

  return `${typeDef}\n${constDef}`
}

function generateExports(matchers: Matcher[], combo: Combination): string {
  const matcherExports = matchers.map((m) => `${m.name}_ as ${m.name}`).join(',\n  ')

  // Add noExcess exports for sub/equiv (not for exact when negated)
  let noExcessExports = ''
  if (!combo.negated && (combo.relator.name === 'sub' || combo.relator.name === 'equiv')) {
    noExcessExports = ',\n  noExcess_ as noExcess,\n  noExcessAs_ as noExcessAs'
  } else if (combo.relator.name === 'exact') {
    noExcessExports = ',\n  noExcess_ as noExcess'
  }

  return `export {
  ${matcherExports},
  ofAs_ as ofAs${noExcessExports},
}`
}

function generateMatcherFile(combo: Combination): string {
  const header = generateFileHeader(combo)
  const fileLevelDoc = generateFileLevelJSDoc(combo)
  const matchers = MATCHERS.map((m) => {
    const jsdoc = generateMatcherJSDoc(m, combo)
    const typeDef = generateMatcherType(m, combo)
    return `${jsdoc}\n${typeDef}`
  }).join('\n\n')

  // Add ofAs const declaration - returns builder (not function, so no .on chain)
  const ofAsConst = typedBuilderConst('ofAs_', buildRuntimeChain(combo, 'ofAs'))

  // Add noExcess/noExcessAs for sub and equiv relators (not for exact, not for negated)
  let noExcessDecls = ''
  if (!combo.negated && (combo.relator.name === 'sub' || combo.relator.name === 'equiv')) {
    const extractorChain = buildExtractorChain(combo.extractors, '$Actual')
    const noExcessKind =
      combo.relator.name === 'sub' ? 'AssertSubNoExcessKind' : 'AssertEquivNoExcessKind'

    if (combo.extractors.length > 0) {
      noExcessDecls = `
/**
 * No-excess variant of ${combo.relator.name} relation.
 * Checks that actual has no excess properties beyond expected.
 */
// oxfmt-ignore
type noExcess_<
  $Expected,
  $Actual,
  __$ActualExtracted = ${extractorChain},
> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<${noExcessKind}, [$Expected, __actual__]>
                                                                         : never
${typedBuilderConst('noExcess_', buildRuntimeChain(combo, 'noExcess'))}
${typedBuilderConst('noExcessAs_', buildRuntimeChain(combo, 'noExcessAs'))}`
    } else {
      noExcessDecls = `
/**
 * No-excess variant of ${combo.relator.name} relation.
 * Checks that actual has no excess properties beyond expected.
 */
type noExcess_<$Expected, $Actual> = Fn.Kind.Apply<${noExcessKind}, [$Expected, $Actual]>
${typedBuilderConst('noExcess_', buildRuntimeChain(combo, 'noExcess'))}
${typedBuilderConst('noExcessAs_', buildRuntimeChain(combo, 'noExcessAs'))}`
    }
  } else if (combo.relator.name === 'exact') {
    // For exact, noExcess is never (just reference it from builder for completeness)
    noExcessDecls = `\ntype noExcess_ = never\n${typedBuilderConst('noExcess_', buildRuntimeChain(combo, 'noExcess'))}`
  }

  const exports = generateExports(MATCHERS, combo)

  return `${header}${fileLevelDoc}
${matchers}

${ofAsConst}${noExcessDecls}

${exports}
`
}

function generateBarrelFile(
  dirPath: string,
  exports: string[],
  extractorsByName: Readonly<Record<string, Extractor>>,
): string {
  // Determine if each export is a file or a directory based on our data structures
  // Extractors are directories (have their own barrel files)
  // Relators are files
  // 'not' is a special directory
  const relPaths = exports.map((name) => {
    if (name in extractorsByName) return `./${name}/__.js`
    if (name === 'not') return `./${name}/__.js`
    return `./${name}.js`
  })

  // Use export * as to re-export dual namespaces from child modules
  const reExports = exports.map((name, i) => `export * as ${name} from '${relPaths[i]}'`).join('\n')

  // Add type-level shorthand for relators (main barrel only has base relators, no extractors)
  const srcDir = join(PACKAGE_DIR, 'src')
  const relatorsPath = getRelativePath(dirPath, join(srcDir, 'asserts.js'))
  const builderPath = getRelativePath(dirPath, join(srcDir, 'builder-singleton.js'))

  const relatorKinds = RELATOR_VALUES.map((relator) => relator.kindName).join(', ')

  const imports = `import type { Fn } from '@kitz/core'
import { builder } from '${builderPath}'
import type { ${relatorKinds} } from '${relatorsPath}'`

  // Root-level unary relator exports
  const unaryRelatorExports = `
// Unary relators
${typedBuilderConst('any', 'builder.any', true)}
${typedBuilderConst('unknown', 'builder.unknown', true)}
${typedBuilderConst('never', 'builder.never', true)}
${typedBuilderConst('empty', 'builder.empty', true)}`

  const typeShorthands = RELATOR_VALUES.map((relator) => {
    return `export type ${relator.name}<$Expected, $Actual> = Fn.Kind.Apply<${relator.kindName}, [$Expected, $Actual]>`
  }).join('\n')

  return `${imports}

${reExports}${unaryRelatorExports}
${typeShorthands}
`
}

/**
 * Generate a barrel file for an extractor subdirectory.
 * Exports relators (type+value), 'not' namespace, and other extractors (value-only via builder proxy).
 */
function generateExtractorBarrelFile(
  extractorName: string,
  barrelPath: string,
  extractorsByName: Readonly<Record<string, Extractor>>,
): string {
  // Calculate relative paths
  const srcDir = join(PACKAGE_DIR, 'src')
  const builderPath = getRelativePath(barrelPath, join(srcDir, 'builder-singleton.js'))
  const relatorsPath = getRelativePath(barrelPath, join(srcDir, 'asserts.js'))

  // Part 1: Export relators as dual namespaces (type+value)
  const relatorExports = RELATOR_VALUES.map(
    (relator) => `export * as ${relator.name} from './${relator.name}.js'`,
  ).join('\n')

  // Part 2: Export 'not' namespace (type+value)
  const notExport = `export * as not from './not/__.js'`

  // Part 3: Export other extractors as value-only builder proxy references
  const otherExtractors = Object.keys(extractorsByName).filter((name) => name !== extractorName)
  const extractorExports =
    otherExtractors.length > 0
      ? `\n// Value-level extractor chaining via builder proxy\n` +
        otherExtractors
          .map((name) => typedBuilderConst(name, `builder.${extractorName}.${name}`, true))
          .join('\n')
      : ''

  // Part 3.5: Export unary relators from builder singleton
  const unaryRelatorExports = `
// Unary relators
${typedBuilderConst('any', `builder.${extractorName}.any`, true)}
${typedBuilderConst('unknown', `builder.${extractorName}.unknown`, true)}
${typedBuilderConst('never', `builder.${extractorName}.never`, true)}
${typedBuilderConst('empty', `builder.${extractorName}.empty`, true)}`

  // Part 4: Add type-level shorthand for relators (allows omitting .of)
  const extractor = extractorsByName[extractorName]
  const relatorKinds = RELATOR_VALUES.map((relator) => relator.kindName).join(', ')

  const imports = `import type { Fn } from '@kitz/core'
import { builder } from '${builderPath}'
import { Optic } from '@kitz/core'
import type { Either } from 'effect'
import type { ${relatorKinds} } from '${relatorsPath}'`

  const extractorChain =
    extractor === undefined ? '$Actual' : `Optic.${kindToDirectType(extractor.kindName)}<$Actual>`

  const typeShorthands = RELATOR_VALUES.map((relator) => {
    return `// oxfmt-ignore\nexport type ${relator.name}<
  $Expected,
  $Actual,
  __$ActualExtracted = ${extractorChain},
> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<${relator.kindName}, [$Expected, __actual__]>
                                                                         : never`
  }).join('\n\n')

  return `${imports}

${relatorExports}
${notExport}${extractorExports}${unaryRelatorExports}
${typeShorthands}
`
}

/**
 * Generate a barrel file for a 'not' subdirectory.
 * Exports only negated relators (type+value) with type-level shorthand.
 */
function generateNotBarrelFile(barrelPath: string, extractors: Extractor[]): string {
  // Calculate relative paths
  const srcDir = join(PACKAGE_DIR, 'src')
  const relatorsPath = getRelativePath(barrelPath, join(srcDir, 'asserts.js'))
  const builderPath = getRelativePath(barrelPath, join(srcDir, 'builder-singleton.js'))

  // Export relators as dual namespaces (type+value)
  const relatorExports = RELATOR_VALUES.map(
    (relator) => `export * as ${relator.name} from './${relator.name}.js'`,
  ).join('\n')

  // Build the runtime chain for unary relators (builder.not.${extractor1}.${extractor2}.${unaryRelator})
  const extractorChainForRuntime = extractors.map((e) => e.name).join('.')
  const builderPrefix = extractorChainForRuntime
    ? `builder.not.${extractorChainForRuntime}`
    : 'builder.not'

  // Export unary relators from builder singleton
  const unaryRelatorExports = `
// Unary relators (negated)
${typedBuilderConst('any', `${builderPrefix}.any`, true)}
${typedBuilderConst('unknown', `${builderPrefix}.unknown`, true)}
${typedBuilderConst('never', `${builderPrefix}.never`, true)}
${typedBuilderConst('empty', `${builderPrefix}.empty`, true)}`

  // Add type-level shorthand for negated relators
  const extractorImports =
    extractors.length > 0
      ? `import { Optic } from '@kitz/core'\nimport type { Either } from 'effect'\n`
      : ''
  const relatorKinds = RELATOR_VALUES.map((relator) => relator.kindName).join(', ')

  const imports = `import type { Fn } from '@kitz/core'
import { builder } from '${builderPath}'
${extractorImports}import type { ${relatorKinds} } from '${relatorsPath}'`

  const typeShorthands = RELATOR_VALUES.map((relator) => {
    if (extractors.length > 0) {
      const extractorChain = buildExtractorChain(extractors, '$Actual')
      return `// oxfmt-ignore\nexport type ${relator.name}<
  $Expected,
  $Actual,
  __$ActualExtracted = ${extractorChain},
> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<${relator.kindName}, [$Expected, __actual__, true]>
                                                                         : never`
    } else {
      // No extractors
      return `export type ${relator.name}<$Expected, $Actual> = Fn.Kind.Apply<${relator.kindName}, [$Expected, $Actual, true]>`
    }
  }).join('\n\n')

  return `${imports}

${relatorExports}
${unaryRelatorExports}
${typeShorthands}
`
}

/**
 * Generate a unary relator file (any, unknown, never, empty).
 * These files provide both type-level and value-level assertions for edge types.
 */
function generateUnaryRelatorFile(unaryRelator: UnaryRelator, negated: boolean): string {
  const srcDir = join(PACKAGE_DIR, 'src')
  const outputPath = negated
    ? join(OUTPUT_DIR, 'not', `${unaryRelator.name}.ts`)
    : join(OUTPUT_DIR, `${unaryRelator.name}.ts`)

  const relatorsPath = getRelativePath(outputPath, join(srcDir, 'asserts.js'))
  const builderPath = getRelativePath(outputPath, join(srcDir, 'builder-singleton.js'))

  const imports = `import type { Fn } from '@kitz/core'
import { builder } from '${builderPath}'
import type { ${unaryRelator.kindName} } from '${relatorsPath}'`

  const description = negated
    ? unaryRelator.description.replace('asserts type is', 'asserts type is NOT')
    : unaryRelator.description

  const passExample = negated
    ? unaryRelator.failExample.replace('_ = Assert.', '_ = Assert.not.')
    : unaryRelator.passExample

  const failExample = negated
    ? unaryRelator.passExample.replace('_ = Assert.', '_ = Assert.not.')
    : unaryRelator.failExample

  const jsdoc = `
/**
 * Unary relator${negated ? ' (negated)' : ''} - ${description}.
 *
 * @example
 * \`\`\`typescript
 * // ✓ Pass
 * ${passExample}
 * Assert${negated ? '.not' : ''}.${unaryRelator.name}(value as ${negated ? 'string' : unaryRelator.name})
 *
 * // ✗ Fail
 * ${failExample}
 * Assert${negated ? '.not' : ''}.${unaryRelator.name}(value as ${negated ? unaryRelator.name : 'string'})
 * \`\`\`
 */`

  const negatedParam = negated ? ', true' : ''
  const typeDef = `type ${unaryRelator.name}_<$Actual> = Fn.Kind.Apply<${unaryRelator.kindName}, [$Actual${negatedParam}]>`
  const constDef = typedBuilderConst(
    `${unaryRelator.name}_`,
    `builder${negated ? '.not' : ''}.${unaryRelator.name}`,
  )
  const exportDef = `export { ${unaryRelator.name}_ as ${unaryRelator.name} }`

  return `${imports}

${jsdoc}
${typeDef}
${constDef}

${exportDef}
`
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ Combination Generation

function generateAllCombinations(
  extractorsByName: Readonly<Record<string, Extractor>>,
): Combination[] {
  const combinations: Combination[] = []

  // Helper to add both normal and negated versions
  const addBothVariants = (extractors: Extractor[], relator: Relator) => {
    const extractorPath = extractors.map((e) => e.name).join('/')
    const basePath = extractorPath ? `${extractorPath}/` : ''

    // Normal version
    combinations.push({
      extractors,
      relator,
      negated: false,
      outputPath: join(OUTPUT_DIR, basePath, `${relator.name}.ts`),
      isBarrel: false,
    })

    // Negated version (in 'not' subdirectory)
    combinations.push({
      extractors,
      relator,
      negated: true,
      outputPath: join(OUTPUT_DIR, basePath, 'not', `${relator.name}.ts`),
      isBarrel: false,
    })
  }

  // Base relators (no extractors)
  for (const relator of RELATOR_VALUES) {
    addBothVariants([], relator)
  }

  // Single extractors
  for (const extractorName of Object.keys(extractorsByName)) {
    for (const relator of RELATOR_VALUES) {
      const extractor = extractorsByName[extractorName]
      if (extractor !== undefined) {
        addBothVariants([extractor], relator)
      }
    }
  }

  // Chained extractors (2+ levels) - DISABLED to avoid combinatorial explosion
  // Type-level API limited to 1 extractor depth
  // Value-level API (via proxy) remains fully recursive
  // const extractorNames = Object.keys(extractorsByName)
  // for (const first of extractorNames) {
  //   for (const second of extractorNames) {
  //     if (first === second) continue
  //     for (const relatorName of Object.keys(RELATORS)) {
  //       addBothVariants([extractorsByName[first]!, extractorsByName[second]!], RELATORS[relatorName]!)
  //     }
  //   }
  // }

  return combinations
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ File Writing

const writeAndLogFile = (targetPath: string, content: string) =>
  pipe(
    ensureDirectory(dirname(targetPath)),
    Effect.zipRight(writeFileString(targetPath, content)),
    Effect.zipRight(Effect.log(`  ✓ ${relative(PACKAGE_DIR, targetPath)}`)),
  )

const writeGeneratedFiles = (extractorsByName: Readonly<Record<string, Extractor>>) =>
  Effect.gen(function* () {
    yield* Effect.log(`Generating type-level test namespace files...\n`)

    const combinations = generateAllCombinations(extractorsByName)
    let filesWritten = 0

    for (const combo of combinations) {
      const content = generateMatcherFile(combo)
      yield* writeAndLogFile(combo.outputPath, content)
      filesWritten += 1
    }

    for (const unaryRelatorName of Object.keys(UNARY_RELATORS)) {
      const unaryRelator = UNARY_RELATORS[unaryRelatorName]
      if (unaryRelator === undefined) {
        continue
      }

      const normalPath = join(OUTPUT_DIR, `${unaryRelator.name}.ts`)
      const normalContent = generateUnaryRelatorFile(unaryRelator, false)
      yield* writeAndLogFile(normalPath, normalContent)
      filesWritten += 1

      const negatedPath = join(OUTPUT_DIR, 'not', `${unaryRelator.name}.ts`)
      const negatedContent = generateUnaryRelatorFile(unaryRelator, true)
      yield* writeAndLogFile(negatedPath, negatedContent)
      filesWritten += 1
    }

    const barrelFiles: Array<{ path: string; exports: string[] }> = [
      {
        path: join(OUTPUT_DIR, '__.ts'),
        exports: [
          'exact',
          'equiv',
          'sub',
          'not',
          'awaited',
          'returned',
          'array',
          'parameters',
          'parameter1',
          'parameter2',
          'parameter3',
          'parameter4',
          'parameter5',
        ],
      },
      { path: join(OUTPUT_DIR, 'not', '__.ts'), exports: ['exact', 'equiv', 'sub'] },
      { path: join(OUTPUT_DIR, 'awaited', '__.ts'), exports: ['exact', 'equiv', 'sub'] },
      { path: join(OUTPUT_DIR, 'returned', '__.ts'), exports: ['exact', 'equiv', 'sub'] },
      { path: join(OUTPUT_DIR, 'array', '__.ts'), exports: ['exact', 'equiv', 'sub'] },
      { path: join(OUTPUT_DIR, 'parameters', '__.ts'), exports: ['exact', 'equiv', 'sub'] },
      { path: join(OUTPUT_DIR, 'parameter1', '__.ts'), exports: ['exact', 'equiv', 'sub'] },
      { path: join(OUTPUT_DIR, 'parameter2', '__.ts'), exports: ['exact', 'equiv', 'sub'] },
      { path: join(OUTPUT_DIR, 'parameter3', '__.ts'), exports: ['exact', 'equiv', 'sub'] },
      { path: join(OUTPUT_DIR, 'parameter4', '__.ts'), exports: ['exact', 'equiv', 'sub'] },
      { path: join(OUTPUT_DIR, 'parameter5', '__.ts'), exports: ['exact', 'equiv', 'sub'] },
      { path: join(OUTPUT_DIR, 'awaited', 'not', '__.ts'), exports: ['exact', 'equiv', 'sub'] },
      { path: join(OUTPUT_DIR, 'returned', 'not', '__.ts'), exports: ['exact', 'equiv', 'sub'] },
      { path: join(OUTPUT_DIR, 'array', 'not', '__.ts'), exports: ['exact', 'equiv', 'sub'] },
      { path: join(OUTPUT_DIR, 'parameters', 'not', '__.ts'), exports: ['exact', 'equiv', 'sub'] },
      { path: join(OUTPUT_DIR, 'parameter1', 'not', '__.ts'), exports: ['exact', 'equiv', 'sub'] },
      { path: join(OUTPUT_DIR, 'parameter2', 'not', '__.ts'), exports: ['exact', 'equiv', 'sub'] },
      { path: join(OUTPUT_DIR, 'parameter3', 'not', '__.ts'), exports: ['exact', 'equiv', 'sub'] },
      { path: join(OUTPUT_DIR, 'parameter4', 'not', '__.ts'), exports: ['exact', 'equiv', 'sub'] },
      { path: join(OUTPUT_DIR, 'parameter5', 'not', '__.ts'), exports: ['exact', 'equiv', 'sub'] },
    ]

    for (const barrel of barrelFiles) {
      const barrelDir = dirname(barrel.path)
      const parentDir = dirname(barrelDir)
      const dirName = basename(barrelDir)

      let content: string
      if (dirName === 'not') {
        const isRootNot = parentDir === OUTPUT_DIR
        const extractors: Extractor[] = []
        if (!isRootNot) {
          const extractorName = basename(parentDir)
          const extractor = extractorsByName[extractorName]
          if (extractor !== undefined) {
            extractors.push(extractor)
          }
        }
        content = generateNotBarrelFile(barrel.path, extractors)
      } else if (barrelDir !== OUTPUT_DIR) {
        content = generateExtractorBarrelFile(dirName, barrel.path, extractorsByName)
      } else {
        content = generateBarrelFile(barrel.path, barrel.exports, extractorsByName)
      }

      yield* writeAndLogFile(barrel.path, content)
      filesWritten += 1
    }

    yield* Effect.log(`\nGenerated ${filesWritten} files successfully!`)
  })

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ Main

const program = pipe(
  setupExtractors,
  Effect.flatMap(writeGeneratedFiles),
  Effect.catchAll((error) =>
    pipe(
      Effect.logError(
        `Failed to initialize extractor registry:\n${formatGenerateBuilderError(error)}`,
      ),
      Effect.zipRight(Effect.fail(error)),
    ),
  ),
  Effect.provide(Platform.FileSystem.layer),
)

await Effect.runPromise(program)
