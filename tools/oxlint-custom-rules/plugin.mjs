// @ts-check

import fs from 'node:fs'
import { builtinModules } from 'node:module'
import path from 'node:path'
import { Either, Option, pipe, Schema } from 'effect'
import { definePlugin, defineRule } from 'oxlint'

/** @typedef {import('oxlint').ESTree.Expression} Expression */
/** @typedef {import('oxlint').ESTree.FunctionDeclaration | import('oxlint').ESTree.FunctionExpression | import('oxlint').ESTree.ArrowFunctionExpression} FunctionLikeNode */
/** @typedef {import('oxlint').ESTree.MemberExpression} MemberExpression */
/** @typedef {import('oxlint').ESTree.Program} Program */
/** @typedef {import('oxlint').ESTree.Statement} Statement */
/** @typedef {import('oxlint').ESTree.TSType} TSType */
/** @typedef {import('oxlint').ESTree.TSTypeName} TSTypeName */
/** @typedef {{ namespaceName: string, sourcePath: string }} NamespaceExport */
/** @typedef {{ importAlias: string, namespaceName: string }} CoreNamespaceConvention */
/** @typedef {{ expectedNamespaceName: string, expectedTargetPath: string | null }} NamespaceFileConvention */

const MESSAGE_IDS = {
  noJsonParse: `noJsonParse`,
  noTryCatch: `noTryCatch`,
  noNativePromiseConstruction: `noNativePromiseConstruction`,
  noTypeAssertion: `noTypeAssertion`,
  noNativeMapSetInEffectModules: `noNativeMapSetInEffectModules`,
  noNodejsBuiltinImports: `noNodejsBuiltinImports`,
  noThrow: `noThrow`,
  noPromiseThenChain: `noPromiseThenChain`,
  noEffectRunInLibraryCode: `noEffectRunInLibraryCode`,
  requireTypedEffectErrors: `requireTypedEffectErrors`,
  requireSchemaDecodeAtBoundary: `requireSchemaDecodeAtBoundary`,
  noProcessEnvOutsideConfigModules: `noProcessEnvOutsideConfigModules`,
  noDateNowInDomain: `noDateNowInDomain`,
  noMathRandomInDomain: `noMathRandomInDomain`,
  noConsoleInEffectModules: `noConsoleInEffectModules`,
  requireTaggedErrorTypes: `requireTaggedErrorTypes`,
  namespaceFileConventionsSingleStatement: `namespaceFileConventionsSingleStatement`,
  namespaceFileConventionsNamespaceExport: `namespaceFileConventionsNamespaceExport`,
  namespaceFileConventionsNamespaceDeclaration: `namespaceFileConventionsNamespaceDeclaration`,
  namespaceFileConventionsNamespaceDeclarationName: `namespaceFileConventionsNamespaceDeclarationName`,
  namespaceFileConventionsNamespaceDeclarationJsDoc: `namespaceFileConventionsNamespaceDeclarationJsDoc`,
  namespaceFileConventionsTypeDeclarationName: `namespaceFileConventionsTypeDeclarationName`,
  namespaceFileConventionsNamespaceName: `namespaceFileConventionsNamespaceName`,
  namespaceFileConventionsTarget: `namespaceFileConventionsTarget`,
  barrelFileConventionsMissingExport: `barrelFileConventionsMissingExport`,
  barrelFileConventionsDefaultExport: `barrelFileConventionsDefaultExport`,
  barrelFileConventionsOnlyImportExport: `barrelFileConventionsOnlyImportExport`,
  moduleStructureConventionsMissingBarrel: `moduleStructureConventionsMissingBarrel`,
  moduleStructureConventionsMultiFileNamespaceTarget: `moduleStructureConventionsMultiFileNamespaceTarget`,
  moduleStructureConventionsSingleFileNamespaceTarget: `moduleStructureConventionsSingleFileNamespaceTarget`,
  moduleStructureConventionsRootEntrypoints: `moduleStructureConventionsRootEntrypoints`,
  noDeepImportsWhenNamespaceEntrypointExists: `noDeepImportsWhenNamespaceEntrypointExists`,
  preferSubpathImports: `preferSubpathImports`,
  subpathImportsIntegrityBrokenRef: `subpathImportsIntegrityBrokenRef`,
  subpathImportsIntegrityWrongFormat: `subpathImportsIntegrityWrongFormat`,
  subpathImportsIntegrityMissingEntry: `subpathImportsIntegrityMissingEntry`,
  subpathImportsIntegrityConditionMismatch: `subpathImportsIntegrityConditionMismatch`,
  subpathImportsIntegrityTsconfigDrift: `subpathImportsIntegrityTsconfigDrift`,
}

const MESSAGES = {
  [MESSAGE_IDS.noJsonParse]: `Use Effect Schema JSON codec/decode at IO boundaries.`,
  [MESSAGE_IDS.noTryCatch]: `Use Effect.try, Effect.tryPromise, Either, Option, typed error channels.`,
  [MESSAGE_IDS.noNativePromiseConstruction]: `Use Effect constructors/combinators.`,
  [MESSAGE_IDS.noTypeAssertion]: `Remove assertion casts; use schema decode/typed constructors.`,
  [MESSAGE_IDS.noNativeMapSetInEffectModules]: `Prefer Effect HashMap / HashSet (mutable variants only when justified).`,
  [MESSAGE_IDS.noNodejsBuiltinImports]:
    `Do not import Node.js built-ins, fs-extra, or pathe; use Effect/@kitz abstractions.`,
  [MESSAGE_IDS.noThrow]: `Use typed Effect failures instead of throw (except approved boundary adapters).`,
  [MESSAGE_IDS.noPromiseThenChain]: `Prefer Effect combinators over Promise.then/catch/finally chains.`,
  [MESSAGE_IDS.noEffectRunInLibraryCode]: `Do not run Effects in library code; return Effects and run them in app/CLI entrypoints or tests.`,
  [MESSAGE_IDS.requireTypedEffectErrors]: `Use precise typed Effect error channels; avoid any/unknown in Effect error position.`,
  [MESSAGE_IDS.requireSchemaDecodeAtBoundary]: `Boundary modules that read env/http/file input must decode with Effect Schema.`,
  [MESSAGE_IDS.noProcessEnvOutsideConfigModules]: `Read process.env only from typed config modules.`,
  [MESSAGE_IDS.noDateNowInDomain]: `Use Effect Clock service instead of Date.now in domain/library code.`,
  [MESSAGE_IDS.noMathRandomInDomain]: `Use Effect Random service instead of Math.random in domain/library code.`,
  [MESSAGE_IDS.noConsoleInEffectModules]: `Use Effect.log* or structured logging adapters instead of console.* in Effect modules.`,
  [MESSAGE_IDS.requireTaggedErrorTypes]: `Effect error channel types should be tagged (include _tag) for pattern matching.`,
  [MESSAGE_IDS.namespaceFileConventionsSingleStatement]:
    `Namespace files (_.ts) may only contain: one namespace export, type-only exports, and one namespace declaration.`,
  [MESSAGE_IDS.namespaceFileConventionsNamespaceExport]:
    `Namespace files (_.ts) must include exactly one value namespace export using 'export * as Name from ...'.`,
  [MESSAGE_IDS.namespaceFileConventionsNamespaceDeclaration]:
    `Namespace files (_.ts) must include one empty exported namespace declaration: 'export namespace Name {}'.`,
  [MESSAGE_IDS.namespaceFileConventionsNamespaceDeclarationName]:
    `Namespace declaration name must match the namespace export name.`,
  [MESSAGE_IDS.namespaceFileConventionsNamespaceDeclarationJsDoc]:
    `Namespace declaration must be preceded by a JSDoc target comment for the namespace export.`,
  [MESSAGE_IDS.namespaceFileConventionsTypeDeclarationName]:
    `In _.ts, exported in-file type declarations must be named exactly the same as the namespace export name.`,
  [MESSAGE_IDS.namespaceFileConventionsNamespaceName]:
    `Namespace export name must match path conventions (including explicit Core* conventions from packages/core/package.json imports).`,
  [MESSAGE_IDS.namespaceFileConventionsTarget]:
    `Namespace export target must match path conventions ('./__.js' for explicit core patterns, otherwise './__.js' or './<module>.js').`,
  [MESSAGE_IDS.barrelFileConventionsMissingExport]:
    `Barrel files (__.ts) must export at least one symbol.`,
  [MESSAGE_IDS.barrelFileConventionsDefaultExport]: `Barrel files (__.ts) must not use default exports.`,
  [MESSAGE_IDS.barrelFileConventionsOnlyImportExport]:
    `Barrel files (__.ts) may only contain top-level import/export declarations.`,
  [MESSAGE_IDS.moduleStructureConventionsMissingBarrel]:
    `Module directories with multiple implementation files must include __.ts.`,
  [MESSAGE_IDS.moduleStructureConventionsMultiFileNamespaceTarget]:
    `Namespace files for multi-file modules must target './__.js'.`,
  [MESSAGE_IDS.moduleStructureConventionsSingleFileNamespaceTarget]:
    `Namespace files for single-file elided modules must target './<implementation>.js'.`,
  [MESSAGE_IDS.moduleStructureConventionsRootEntrypoints]:
    `Regular packages must define both src/_.ts and src/__.ts root entrypoints.`,
  [MESSAGE_IDS.noDeepImportsWhenNamespaceEntrypointExists]:
    `Import bypasses a namespace boundary (_.ts exists in an ancestor directory). Use the _.ts or __.ts entrypoint instead.`,
  [MESSAGE_IDS.preferSubpathImports]:
    `A # subpath import exists for this module. Use the subpath import instead of a relative path.`,
  [MESSAGE_IDS.subpathImportsIntegrityBrokenRef]:
    `Subpath import target file does not exist.`,
  [MESSAGE_IDS.subpathImportsIntegrityWrongFormat]:
    `Subpath import target should use ./src/*.ts format, not ./build/*.js.`,
  [MESSAGE_IDS.subpathImportsIntegrityMissingEntry]:
    `Module has _.ts but no corresponding # subpath import entry in package.json.`,
  [MESSAGE_IDS.subpathImportsIntegrityConditionMismatch]:
    `Conditional import target filename does not match its condition key (e.g. browser condition should target *.browser.* file).`,
  [MESSAGE_IDS.subpathImportsIntegrityTsconfigDrift]:
    `tsconfig.json paths have drifted from package.json imports. Auto-fixing.`,
}

/**
 * @param {unknown} node
 * @returns {node is { type: 'Identifier'; name: string }}
 */
const isIdentifier = (node) =>
  typeof node === `object` && node !== null && `type` in node && node.type === `Identifier`

/**
 * @param {Expression} expression
 * @returns {expression is MemberExpression}
 */
const isMemberExpression = (expression) => expression.type === `MemberExpression`

/**
 * @param {MemberExpression} memberExpression
 * @returns {string | null}
 */
const getPropertyName = (memberExpression) => {
  if (!memberExpression.computed) {
    return isIdentifier(memberExpression.property) ? memberExpression.property.name : null
  }

  if (memberExpression.property.type === `Literal` && typeof memberExpression.property.value === `string`) {
    return memberExpression.property.value
  }

  return null
}

/**
 * @param {Expression} expression
 * @returns {boolean}
 */
const isJsonObjectReference = (expression) => {
  if (isIdentifier(expression) && expression.name === `JSON`) {
    return true
  }

  if (!isMemberExpression(expression)) {
    return false
  }

  if (!isIdentifier(expression.object) || expression.object.name !== `globalThis`) {
    return false
  }

  return getPropertyName(expression) === `JSON`
}

/**
 * @param {Expression} expression
 * @returns {boolean}
 */
const isPromiseConstructorReference = (expression) => {
  if (isIdentifier(expression) && expression.name === `Promise`) {
    return true
  }

  if (!isMemberExpression(expression)) {
    return false
  }

  if (!isIdentifier(expression.object) || expression.object.name !== `globalThis`) {
    return false
  }

  return getPropertyName(expression) === `Promise`
}

/**
 * @param {Expression} expression
 * @returns {boolean}
 */
const isDateConstructorReference = (expression) => {
  if (isIdentifier(expression) && expression.name === `Date`) {
    return true
  }

  if (!isMemberExpression(expression)) {
    return false
  }

  if (!isIdentifier(expression.object) || expression.object.name !== `globalThis`) {
    return false
  }

  return getPropertyName(expression) === `Date`
}

/**
 * @param {Expression} expression
 * @returns {boolean}
 */
const isMathObjectReference = (expression) => {
  if (isIdentifier(expression) && expression.name === `Math`) {
    return true
  }

  if (!isMemberExpression(expression)) {
    return false
  }

  if (!isIdentifier(expression.object) || expression.object.name !== `globalThis`) {
    return false
  }

  return getPropertyName(expression) === `Math`
}

const NODE_BUILTIN_MODULES = new Set(
  builtinModules.map((moduleName) => moduleName.startsWith(`node:`) ? moduleName.slice(`node:`.length) : moduleName),
)
const DISALLOWED_EFFECT_PLATFORM_ALTERNATIVES = [`fs-extra`, `pathe`]
const NODE_COMPATIBLE_CONDITION_KEYS = new Set([`node`, `bun`])

const PackageJsonRecordSchema = Schema.Record({ key: Schema.String, value: Schema.Unknown })
const PackageConditionTargetSchema = Schema.suspend(() =>
  Schema.Union(
    Schema.String,
    Schema.Null,
    Schema.Array(PackageConditionTargetSchema),
    Schema.Record({ key: Schema.String, value: PackageConditionTargetSchema }),
  ))

const decodePackageJsonRecord = Schema.decodeUnknownOption(Schema.parseJson(PackageJsonRecordSchema))
const decodePackageConditionTarget = Schema.decodeUnknownOption(PackageConditionTargetSchema)

/**
 * @param {unknown} literalNode
 * @returns {string | null}
 */
const getStringLiteralValue = (literalNode) =>
  typeof literalNode === `object` &&
    literalNode !== null &&
    `type` in literalNode &&
    literalNode.type === `Literal` &&
    typeof literalNode.value === `string`
    ? literalNode.value
    : null

/**
 * @param {string} importPath
 * @returns {boolean}
 */
const isNodeBuiltinImportPath = (importPath) => {
  const normalized = importPath.startsWith(`node:`) ? importPath.slice(`node:`.length) : importPath

  if (NODE_BUILTIN_MODULES.has(normalized)) {
    return true
  }

  if (normalized.startsWith(`@`)) {
    return false
  }

  const slashIndex = normalized.indexOf(`/`)
  if (slashIndex <= 0) {
    return false
  }

  return NODE_BUILTIN_MODULES.has(normalized.slice(0, slashIndex))
}

/**
 * @param {string} importPath
 * @returns {boolean}
 */
const isDisallowedEffectPlatformAlternativePath = (importPath) =>
  DISALLOWED_EFFECT_PLATFORM_ALTERNATIVES.some((packageName) =>
    importPath === packageName || importPath.startsWith(`${packageName}/`))

/**
 * @param {Record<string, unknown>} packageJsonRecord
 * @param {'exports' | 'imports'} fieldName
 * @returns {Option.Option<Option.Option<unknown>>}
 */
const decodeOptionalPackageConditionTarget = (packageJsonRecord, fieldName) => {
  if (!(fieldName in packageJsonRecord)) {
    return Option.some(Option.none())
  }

  return pipe(
    decodePackageConditionTarget(packageJsonRecord[fieldName]),
    Option.map((target) => Option.some(target)),
  )
}

/**
 * @param {string} packageJsonContent
 * @returns {Option.Option<{ exports?: unknown, imports?: unknown }>}
 */
const decodeRuntimeConditionPackageJson = (packageJsonContent) =>
  pipe(
    decodePackageJsonRecord(packageJsonContent),
    Option.flatMap((packageJsonRecord) =>
      pipe(
        decodeOptionalPackageConditionTarget(packageJsonRecord, `exports`),
        Option.flatMap((exportsTarget) =>
          pipe(
            decodeOptionalPackageConditionTarget(packageJsonRecord, `imports`),
            Option.map((importsTarget) => ({
              exports: Option.match(exportsTarget, {
                onNone: () => undefined,
                onSome: (target) => target,
              }),
              imports: Option.match(importsTarget, {
                onNone: () => undefined,
                onSome: (target) => target,
              }),
            })),
          ),
        ),
      ),
    ),
  )

/**
 * @param {unknown} targetNode
 * @param {boolean} withinNodeCompatibleCondition
 * @param {Set<string>} nodeCompatibleTargets
 * @returns {void}
 */
const collectNodeCompatibleTargets = (
  targetNode,
  withinNodeCompatibleCondition,
  nodeCompatibleTargets,
) => {
  if (typeof targetNode === `string`) {
    if (withinNodeCompatibleCondition) {
      nodeCompatibleTargets.add(normalizePath(targetNode))
    }
    return
  }

  if (targetNode === null) {
    return
  }

  if (Array.isArray(targetNode)) {
    for (const entry of targetNode) {
      collectNodeCompatibleTargets(entry, withinNodeCompatibleCondition, nodeCompatibleTargets)
    }
    return
  }

  if (!isRecord(targetNode)) {
    return
  }

  for (const [conditionName, conditionValue] of Object.entries(targetNode)) {
    collectNodeCompatibleTargets(
      conditionValue,
      withinNodeCompatibleCondition || NODE_COMPATIBLE_CONDITION_KEYS.has(conditionName),
      nodeCompatibleTargets,
    )
  }
}

/**
 * @param {string} sourceFilePath
 * @returns {Option.Option<string>}
 */
const findNearestPackageJsonPath = (sourceFilePath) => {
  let currentDirectory = path.dirname(sourceFilePath)

  while (true) {
    const packageJsonPath = path.join(currentDirectory, `package.json`)
    if (fs.existsSync(packageJsonPath)) {
      return Option.some(packageJsonPath)
    }

    const parentDirectory = path.dirname(currentDirectory)
    if (parentDirectory === currentDirectory) {
      return Option.none()
    }
    currentDirectory = parentDirectory
  }
}

/**
 * @param {string} sourceExtension
 * @returns {string[]}
 */
const getBuildTargetExtensionsForSourceExtension = (sourceExtension) => {
  if (sourceExtension === `.mts`) {
    return [`.mjs`, `.js`]
  }

  if (sourceExtension === `.cts`) {
    return [`.cjs`, `.js`]
  }

  if (sourceExtension === `.ts` || sourceExtension === `.tsx`) {
    return [`.js`]
  }

  return []
}

/**
 * @param {string} packageRoot
 * @param {string} sourceFilePath
 * @returns {Option.Option<Set<string>>}
 */
const getFileTargetCandidates = (packageRoot, sourceFilePath) => {
  const relativePath = normalizePath(path.relative(packageRoot, sourceFilePath))
  if (relativePath.length === 0 || relativePath.startsWith(`..`)) {
    return Option.none()
  }

  const targetCandidates = new Set([`./${relativePath}`])

  if (!relativePath.startsWith(`src/`)) {
    return Option.some(targetCandidates)
  }

  const sourceRelativePath = relativePath.slice(`src/`.length)
  const sourceExtensionMatch = /\.[^/.]+$/.exec(sourceRelativePath)
  if (sourceExtensionMatch === null) {
    return Option.some(targetCandidates)
  }

  const sourceExtension = sourceExtensionMatch[0]
  const sourcePathWithoutExtension = sourceRelativePath.slice(0, -sourceExtension.length)
  for (const buildExtension of getBuildTargetExtensionsForSourceExtension(sourceExtension)) {
    targetCandidates.add(`./build/${sourcePathWithoutExtension}${buildExtension}`)
  }

  return Option.some(targetCandidates)
}

/**
 * @param {string} sourceFilePath
 * @returns {Option.Option<{ packageRoot: string, runtimeConditions: { exports?: unknown, imports?: unknown } }>}
 */
const readNearestRuntimeConditionPackage = (sourceFilePath) =>
  pipe(
    findNearestPackageJsonPath(sourceFilePath),
    Option.flatMap((packageJsonPath) =>
      pipe(
        Either.try({
          try: () => fs.readFileSync(packageJsonPath, `utf8`),
          catch: () => null,
        }),
        Either.match({
          onLeft: () => Option.none(),
          onRight: (packageJsonContent) =>
            pipe(
              decodeRuntimeConditionPackageJson(packageJsonContent),
              Option.map((runtimeConditions) => ({
                packageRoot: path.dirname(packageJsonPath),
                runtimeConditions,
              })),
            ),
        }),
      ),
    ),
  )

/**
 * @param {string} sourceFilePath
 * @returns {boolean}
 */
const isNodeBuiltinImportAllowedInFile = (sourceFilePath) =>
  pipe(
    readNearestRuntimeConditionPackage(sourceFilePath),
    Option.map(({ packageRoot, runtimeConditions }) => {
      const nodeCompatibleTargets = new Set()
      if (runtimeConditions.exports !== undefined) {
        collectNodeCompatibleTargets(runtimeConditions.exports, false, nodeCompatibleTargets)
      }

      if (runtimeConditions.imports !== undefined) {
        collectNodeCompatibleTargets(runtimeConditions.imports, false, nodeCompatibleTargets)
      }

      if (nodeCompatibleTargets.size === 0) {
        return false
      }

      return pipe(
        getFileTargetCandidates(packageRoot, sourceFilePath),
        Option.map((targetCandidates) => {
          for (const candidate of targetCandidates) {
            for (const targetPattern of nodeCompatibleTargets) {
              if (matchesGlobPattern(candidate, targetPattern)) {
                return true
              }
            }
          }

          return false
        }),
        Option.getOrElse(() => false),
      )
    }),
    Option.getOrElse(() => false),
  )

/**
 * @param {TSTypeName} typeName
 * @returns {string | null}
 */
const getTypeName = (typeName) => {
  if (typeName.type === `Identifier`) {
    return typeName.name
  }

  if (typeName.type === `TSQualifiedName`) {
    return typeName.right.name
  }

  return null
}

/**
 * @param {string} filePath
 * @returns {string}
 */
const normalizePath = (filePath) => filePath.split(path.sep).join(`/`)

const globRegexCache = new Map()
const reportedMissingRootEntrypoints = new Set()
const coreNamespaceConventionsCache = new Map()

/**
 * @param {string} pattern
 * @returns {RegExp}
 */
const compileGlobPattern = (pattern) => {
  const normalizedPattern = normalizePath(pattern)
  if (globRegexCache.has(normalizedPattern)) {
    return globRegexCache.get(normalizedPattern)
  }

  let expression = `^`
  for (let index = 0; index < normalizedPattern.length; index += 1) {
    const char = normalizedPattern[index]

    if (char === `*`) {
      if (normalizedPattern[index + 1] === `*`) {
        expression += `.*`
        index += 1
      } else {
        expression += `[^/]*`
      }
      continue
    }

    if (char === `?`) {
      expression += `[^/]`
      continue
    }

    if (`\\^$+?.()|{}[]`.includes(char)) {
      expression += `\\${char}`
      continue
    }

    expression += char
  }

  expression += `$`
  const regularExpression = new RegExp(expression)
  globRegexCache.set(normalizedPattern, regularExpression)
  return regularExpression
}

/**
 * @param {string} filePath
 * @param {string} pattern
 * @returns {boolean}
 */
const matchesGlobPattern = (filePath, pattern) => compileGlobPattern(pattern).test(filePath)

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
const isRecord = (value) => typeof value === `object` && value !== null && !Array.isArray(value)

/**
 * @param {string} sourceFileName
 * @returns {string}
 */
const toModuleRuntimeFileName = (sourceFileName) => sourceFileName.replace(/\.[cm]?[jt]sx?$/, `.js`)

/**
 * @param {string} value
 * @returns {string}
 */
const toPascalCase = (value) => {
  const withoutLeadingUnderscore = value.replace(/^_+/, ``)
  const hasDollarPrefix = withoutLeadingUnderscore.startsWith(`$`)
  const normalized = hasDollarPrefix ? withoutLeadingUnderscore.slice(1) : withoutLeadingUnderscore
  const parts = normalized.split(/[-_]/g).filter((part) => part.length > 0)
  const pascal = parts.map((part) => part[0].toUpperCase() + part.slice(1)).join(``)
  return hasDollarPrefix ? `$${pascal}` : pascal
}

/**
 * @param {string} value
 * @returns {string}
 */
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, `\\$&`)

/**
 * @param {string} filePath
 * @returns {{
 *   packageName: string,
 *   sourceRelativePath: string,
 *   packageSourceDirectoryRelativePath: string,
 * } | null}
 */
const getPackageSourcePathDetails = (filePath) => {
  const pathSegments = filePath.split(`/`)
  const packagesSegmentIndex = pathSegments.findIndex((segment, index) => {
    return segment === `packages` && pathSegments[index + 2] === `src`
  })

  if (packagesSegmentIndex === -1) {
    return null
  }

  const packageName = pathSegments[packagesSegmentIndex + 1]
  if (typeof packageName !== `string`) {
    return null
  }

  const packageSourceDirectoryRelativePath = pathSegments.slice(0, packagesSegmentIndex + 3).join(`/`)
  const sourceRelativePath = pathSegments.slice(packagesSegmentIndex + 3).join(`/`)

  return {
    packageName,
    sourceRelativePath,
    packageSourceDirectoryRelativePath,
  }
}

/**
 * @param {string} filePath
 * @returns {string | null}
 */
const getExpectedNamespaceName = (filePath) => {
  const packageSourcePathDetails = getPackageSourcePathDetails(filePath)
  if (!packageSourcePathDetails) {
    return null
  }

  if (packageSourcePathDetails.sourceRelativePath === `_.ts`) {
    return toPascalCase(packageSourcePathDetails.packageName)
  }

  return toPascalCase(path.basename(path.dirname(filePath)))
}

/**
 * @param {string} cwd
 * @returns {Map<string, CoreNamespaceConvention>}
 */
const getCoreNamespaceConventions = (cwd) => {
  const cacheKey = normalizePath(cwd)
  if (coreNamespaceConventionsCache.has(cacheKey)) {
    return coreNamespaceConventionsCache.get(cacheKey)
  }

  const conventions = new Map()
  const corePackageJsonPath = path.join(cwd, `packages/core/package.json`)
  const corePackageImports = pipe(
    Either.try({
      try: () => fs.readFileSync(corePackageJsonPath, `utf8`),
      catch: () => null,
    }),
    Either.match({
      onLeft: () => Option.none(),
      onRight: (packageJsonContent) =>
        pipe(
          decodePackageJsonRecord(packageJsonContent),
          Option.flatMap((packageJsonRecord) =>
            `imports` in packageJsonRecord && isRecord(packageJsonRecord.imports)
              ? Option.some(packageJsonRecord.imports)
              : Option.none()),
        ),
    }),
  )

  if (Option.isNone(corePackageImports)) {
    coreNamespaceConventionsCache.set(cacheKey, conventions)
    return conventions
  }

  for (const [importAlias, importTarget] of Object.entries(corePackageImports.value)) {
    if (!importAlias.startsWith(`#`) || !importAlias.endsWith(`/core`) || typeof importTarget !== `string`) {
      continue
    }

    const moduleName = importAlias.slice(1, -`/core`.length)
    if (!/^[a-z0-9-]+$/.test(moduleName)) {
      continue
    }

    const normalizedImportTarget = normalizePath(importTarget)
    const expectedImportTarget = `./build/${moduleName}/core/_.js`
    if (normalizedImportTarget !== expectedImportTarget) {
      continue
    }

    conventions.set(moduleName, {
      importAlias,
      namespaceName: `Core${toPascalCase(moduleName)}`,
    })
  }

  coreNamespaceConventionsCache.set(cacheKey, conventions)
  return conventions
}

/**
 * @param {string} filePath
 * @param {string} cwd
 * @returns {NamespaceFileConvention | null}
 */
const getNamespaceFileConvention = (filePath, cwd) => {
  const packageSourcePathDetails = getPackageSourcePathDetails(filePath)
  if (
    packageSourcePathDetails !== null &&
    packageSourcePathDetails.packageName === `core`
  ) {
    const coreModuleMatch = /^([^/]+)\/core\/_.ts$/.exec(packageSourcePathDetails.sourceRelativePath)
    if (coreModuleMatch !== null) {
      const [, moduleName] = coreModuleMatch
      const coreConvention = getCoreNamespaceConventions(cwd).get(moduleName)
      if (coreConvention !== undefined) {
        return {
          expectedNamespaceName: coreConvention.namespaceName,
          expectedTargetPath: `./__.js`,
        }
      }
    }
  }

  const expectedNamespaceName = getExpectedNamespaceName(filePath)
  if (expectedNamespaceName === null) {
    return null
  }

  return {
    expectedNamespaceName,
    expectedTargetPath: null,
  }
}

/**
 * @param {string} sourcePath
 * @returns {boolean}
 */
const isValidNamespaceTargetPath = (sourcePath) =>
  sourcePath === `./__.js` || /^\.\/[^/]+\.js$/.test(sourcePath)

/**
 * @param {unknown} moduleExportName
 * @returns {string | null}
 */
const getModuleExportName = (moduleExportName) => {
  if (!isRecord(moduleExportName) || moduleExportName.type === undefined) {
    return null
  }

  if (
    moduleExportName.type === `Identifier` ||
    moduleExportName.type === `IdentifierReference` ||
    moduleExportName.type === `IdentifierName`
  ) {
    return typeof moduleExportName.name === `string` ? moduleExportName.name : null
  }

  if (moduleExportName.type === `Literal`) {
    return typeof moduleExportName.value === `string` ? moduleExportName.value : null
  }

  return null
}

/**
 * @param {Statement} statement
 * @returns {{ namespaceName: string, sourcePath: string } | null}
 */
const getNamespaceExportFromStatement = (statement) => {
  if (
    statement.type === `ExportAllDeclaration` &&
    statement.exported !== null &&
    statement.exportKind !== `type`
  ) {
    const namespaceName = getModuleExportName(statement.exported)
    const sourcePath = statement.source.value
    if (namespaceName === null || typeof sourcePath !== `string`) {
      return null
    }

    return {
      namespaceName,
      sourcePath,
    }
  }

  if (
    statement.type === `ExportNamedDeclaration` &&
    statement.exportKind !== `type` &&
    statement.source !== null &&
    statement.specifiers.length === 1
  ) {
    const [specifier] = statement.specifiers
    if (!isRecord(specifier) || specifier.type === undefined) {
      return null
    }

    if (specifier.type === `ExportNamespaceSpecifier`) {
      const namespaceName = getModuleExportName(specifier.exported)
      const sourcePath = statement.source.value
      if (namespaceName === null || typeof sourcePath !== `string`) {
        return null
      }

      return {
        namespaceName,
        sourcePath,
      }
    }

    if (specifier.type !== `ExportSpecifier`) {
      return null
    }

    const localName = getModuleExportName(specifier.local)
    const namespaceName = getModuleExportName(specifier.exported)
    const sourcePath = statement.source.value

    if (localName !== `*` || namespaceName === null || typeof sourcePath !== `string`) {
      return null
    }

    return {
      namespaceName,
      sourcePath,
    }
  }

  return null
}

/**
 * @param {Program} program
 * @returns {NamespaceExport[]}
 */
const getNamespaceExportsFromProgram = (program) =>
  program.body
    .map((statement) => getNamespaceExportFromStatement(statement))
    .filter((namespaceExport) => namespaceExport !== null)

/**
 * @param {Program} program
 * @returns {NamespaceExport | null}
 */
const getNamespaceExportFromProgram = (program) => {
  const namespaceExports = getNamespaceExportsFromProgram(program)
  if (namespaceExports.length !== 1) {
    return null
  }

  return namespaceExports[0]
}

/**
 * @param {Statement} statement
 * @returns {boolean}
 */
const isTypeOnlyExportStatement = (statement) => {
  if (statement.type === `ExportAllDeclaration`) {
    return statement.exportKind === `type`
  }

  if (statement.type !== `ExportNamedDeclaration`) {
    return false
  }

  if (statement.exportKind === `type`) {
    return true
  }

  if (!isRecord(statement.declaration)) {
    return false
  }

  return (
    statement.declaration.type === `TSInterfaceDeclaration` ||
    statement.declaration.type === `TSTypeAliasDeclaration`
  )
}

/**
 * @param {Statement} statement
 * @returns {Array<{ typeName: string, node: unknown }>}
 */
const getInFileExportedTypeDeclarations = (statement) => {
  if (statement.type !== `ExportNamedDeclaration` || !isRecord(statement.declaration)) {
    return []
  }

  const declaration = statement.declaration
  if (
    declaration.type !== `TSInterfaceDeclaration` &&
    declaration.type !== `TSTypeAliasDeclaration`
  ) {
    return []
  }

  const typeName = getModuleExportName(declaration.id)
  if (typeName === null) {
    return []
  }

  return [
    {
      typeName,
      node: declaration.id,
    },
  ]
}

/**
 * @param {Statement} statement
 * @returns {{ namespaceName: string, isEmpty: boolean } | null}
 */
const getNamespaceDeclarationFromStatement = (statement) => {
  if (statement.type !== `ExportNamedDeclaration` || !isRecord(statement.declaration)) {
    return null
  }

  const declaration = statement.declaration
  if (declaration.type !== `TSModuleDeclaration`) {
    return null
  }

  const namespaceName = getModuleExportName(declaration.id)
  if (namespaceName === null) {
    return null
  }

  const body = declaration.body
  const isEmpty = isRecord(body) && body.type === `TSModuleBlock` && Array.isArray(body.body) && body.body.length === 0

  return {
    namespaceName,
    isEmpty,
  }
}

/**
 * @param {string} sourceText
 * @param {string} namespaceName
 * @returns {boolean}
 */
const hasNamespaceDeclarationWithJsDoc = (sourceText, namespaceName) => {
  const escapedNamespaceName = escapeRegExp(namespaceName)
  const jsDocPattern = new RegExp(
    `/\\*\\*[\\s\\S]*?\\*/\\s*export\\s+namespace\\s+${escapedNamespaceName}\\s*\\{\\s*\\}`,
    `m`,
  )
  return jsDocPattern.test(sourceText)
}

/**
 * @param {string} fileName
 * @returns {boolean}
 */
const isTsSourceFileName = (fileName) => /\.[cm]?[jt]sx?$/.test(fileName)

/**
 * @param {string} fileName
 * @returns {boolean}
 */
const isTypeDefinitionFileName = (fileName) =>
  fileName.endsWith(`.d.ts`) || fileName.endsWith(`.test-d.ts`) || fileName.endsWith(`.spec-d.ts`)

/**
 * @param {string} fileName
 * @returns {boolean}
 */
const isTestLikeFileName = (fileName) =>
  fileName.includes(`.test.`) ||
  fileName.includes(`.spec.`) ||
  fileName.includes(`.bench.`) ||
  fileName.endsWith(`.test-d.ts`) ||
  fileName.endsWith(`.spec-d.ts`)

/**
 * @param {string} fileName
 * @returns {boolean}
 */
const isImplementationSourceFileName = (fileName) =>
  isTsSourceFileName(fileName) &&
  fileName !== `_.ts` &&
  fileName !== `__.ts` &&
  !isTypeDefinitionFileName(fileName) &&
  !isTestLikeFileName(fileName)

/**
 * @param {string} directoryPath
 * @returns {{ hasBarrel: boolean, implementationFiles: string[] } | null}
 */
const readModuleDirectoryState = (directoryPath) => {
  let directoryEntries
  try {
    directoryEntries = fs.readdirSync(directoryPath, { withFileTypes: true })
  } catch {
    return null
  }

  const tsFileNames = directoryEntries
    .filter((entry) => entry.isFile() && isTsSourceFileName(entry.name))
    .map((entry) => entry.name)

  return {
    hasBarrel: tsFileNames.includes(`__.ts`),
    implementationFiles: tsFileNames.filter(isImplementationSourceFileName),
  }
}

/**
 * @param {import('oxlint').Context} context
 * @returns {string}
 */
const getNormalizedRelativePath = (context) => normalizePath(path.relative(context.cwd, context.filename))

/**
 * @param {string} filePath
 * @returns {boolean}
 */
const isTestFilePath = (filePath) =>
  filePath.includes(`/__tests__/`) || /(?:\.(?:test|spec)(?:-d)?|\.bench-d)\.[cm]?[jt]sx?$/.test(filePath)

/**
 * @param {string} filePath
 * @returns {boolean}
 */
const isReleaseEffectModule = (filePath) =>
  filePath.includes(`/packages/release/src/`) || filePath.startsWith(`packages/release/src/`)

/**
 * @param {string} filePath
 * @returns {boolean}
 */
const isBoundaryAdapterFile = (filePath) => {
  if (isTestFilePath(filePath)) {
    return true
  }

  return (
    filePath.includes(`/src/cli/`) ||
    filePath.includes(`/src/app/`) ||
    filePath.includes(`/src/entrypoint/`) ||
    filePath.includes(`/src/adapters/`) ||
    filePath.includes(`/src/adaptors/`) ||
    filePath.includes(`/src/live/`) ||
    filePath.includes(`/scripts/`) ||
    filePath.includes(`/bin/`) ||
    filePath.endsWith(`/cli.ts`) ||
    filePath.endsWith(`/main.ts`) ||
    filePath.endsWith(`/entrypoint.ts`)
  )
}

/**
 * Packages that intentionally do NOT use Effect and should be excluded
 * from Effect-first rules (no-throw, no-try-catch, no-promise-then-chain).
 */
const nonEffectPackages = [
  `packages/ware/`,
]

/**
 * Check if a file belongs to a non-Effect package.
 *
 * Non-Effect packages use promises, throws, and try/catch as their
 * standard patterns — Effect-first lint rules don't apply there.
 */
const isNonEffectPackage = (filePath) => {
  return nonEffectPackages.some((pkg) => filePath.startsWith(pkg))
}


/**
 * @param {string} filePath
 * @returns {boolean}
 */
const isEffectRunAllowedFile = (filePath) => isBoundaryAdapterFile(filePath)

/**
 * @param {Expression} expression
 * @returns {boolean}
 */
const isEffectReference = (expression) => isIdentifier(expression) && expression.name === `Effect`

/**
 * @param {string | null} name
 * @returns {boolean}
 */
const isEffectRunMethodName = (name) => name !== null && (name === `run` || /^run[A-Z]/.test(name))

/**
 * @param {TSTypeName} typeName
 * @returns {boolean}
 */
const isEffectTypeName = (typeName) => {
  if (typeName.type === `Identifier`) {
    return typeName.name === `Effect`
  }

  if (typeName.type === `TSQualifiedName`) {
    return (
      typeName.right.name === `Effect` &&
      typeName.left.type === `Identifier` &&
      typeName.left.name === `Effect`
    )
  }

  return false
}

/**
 * @param {TSType} typeAnnotation
 * @returns {boolean}
 */
const isAnyOrUnknownType = (typeAnnotation) =>
  typeAnnotation.type === `TSAnyKeyword` || typeAnnotation.type === `TSUnknownKeyword`

/**
 * @param {TSType} typeAnnotation
 * @returns {boolean}
 */
const isAnyTypeAnnotation = (typeAnnotation) => typeAnnotation.type === `TSAnyKeyword`

const ADVANCED_SIGNATURE_TYPE_NODES = new Set([
  `TSConditionalType`,
  `TSImportType`,
  `TSIndexedAccessType`,
  `TSInferType`,
  `TSMappedType`,
  `TSTemplateLiteralType`,
  `TSTypeOperator`,
])

/**
 * @param {unknown} node
 * @returns {node is FunctionLikeNode}
 */
const isFunctionLikeNode = (node) =>
  typeof node === `object` &&
    node !== null &&
    `type` in node &&
    (node.type === `FunctionDeclaration` ||
      node.type === `FunctionExpression` ||
      node.type === `ArrowFunctionExpression`)

/**
 * @param {unknown} node
 * @param {Set<object>} [visited]
 * @returns {boolean}
 */
const nodeContainsAdvancedSignatureType = (node, visited = new Set()) => {
  if (typeof node !== `object` || node === null) {
    return false
  }

  if (visited.has(node)) {
    return false
  }
  visited.add(node)

  if (
    `type` in node &&
    typeof node.type === `string` &&
    ADVANCED_SIGNATURE_TYPE_NODES.has(node.type)
  ) {
    return true
  }

  for (const [key, value] of Object.entries(/** @type {Record<string, unknown>} */ (node))) {
    if (key === `parent`) {
      continue
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        if (nodeContainsAdvancedSignatureType(item, visited)) {
          return true
        }
      }
      continue
    }

    if (nodeContainsAdvancedSignatureType(value, visited)) {
      return true
    }
  }

  return false
}

/**
 * @param {unknown} parameterNode
 * @returns {TSType | null}
 */
const getParameterTypeAnnotation = (parameterNode) => {
  if (typeof parameterNode !== `object` || parameterNode === null || !(`type` in parameterNode)) {
    return null
  }

  if (
    `typeAnnotation` in parameterNode &&
    typeof parameterNode.typeAnnotation === `object` &&
    parameterNode.typeAnnotation !== null &&
    `type` in parameterNode.typeAnnotation &&
    parameterNode.typeAnnotation.type === `TSTypeAnnotation`
  ) {
    return parameterNode.typeAnnotation.typeAnnotation
  }

  if (parameterNode.type === `AssignmentPattern`) {
    return getParameterTypeAnnotation(parameterNode.left)
  }

  if (parameterNode.type === `RestElement`) {
    return getParameterTypeAnnotation(parameterNode.argument)
  }

  if (parameterNode.type === `TSParameterProperty`) {
    return getParameterTypeAnnotation(parameterNode.parameter)
  }

  return null
}

/**
 * @param {FunctionLikeNode} functionNode
 * @returns {boolean}
 */
const signatureHasAdvancedType = (functionNode) => {
  const typeParameters = functionNode.typeParameters?.params ?? []
  for (const typeParameter of typeParameters) {
    if (nodeContainsAdvancedSignatureType(typeParameter)) {
      return true
    }
  }

  for (const parameter of functionNode.params) {
    const typeAnnotation = getParameterTypeAnnotation(parameter)
    if (typeAnnotation !== null && nodeContainsAdvancedSignatureType(typeAnnotation)) {
      return true
    }
  }

  if (
    functionNode.returnType !== null &&
    functionNode.returnType !== undefined &&
    nodeContainsAdvancedSignatureType(functionNode.returnType.typeAnnotation)
  ) {
    return true
  }

  return false
}

/**
 * @param {FunctionLikeNode} functionNode
 * @returns {boolean}
 */
const isComplexSignature = (functionNode) =>
  (functionNode.typeParameters?.params?.length ?? 0) > 0 && signatureHasAdvancedType(functionNode)

/**
 * @param {unknown} node
 * @returns {FunctionLikeNode | null}
 */
const getEnclosingFunction = (node) => {
  let current = typeof node === `object` && node !== null && `parent` in node ? node.parent : null
  while (current) {
    if (isFunctionLikeNode(current)) {
      return current
    }
    current = current.parent
  }
  return null
}

/**
 * @param {unknown} node
 * @param {FunctionLikeNode} functionNode
 * @returns {boolean}
 */
const isWithinReturnedExpression = (node, functionNode) => {
  let current = typeof node === `object` && node !== null ? node : null

  if (functionNode.type === `ArrowFunctionExpression` && functionNode.expression) {
    while (current && current !== functionNode) {
      if (current === functionNode.body) {
        return true
      }
      current = current.parent
    }
    return false
  }

  while (current && current !== functionNode) {
    if (current.type === `ReturnStatement` && current.argument !== null) {
      return true
    }
    current = current.parent
  }

  return false
}

/**
 * @param {import('oxlint').ESTree.TSAsExpression | import('oxlint').ESTree.TSTypeAssertion} node
 * @returns {boolean}
 */
const isAllowedComplexReturnAnyAssertion = (node) => {
  if (!isAnyTypeAnnotation(node.typeAnnotation)) {
    return false
  }

  const enclosingFunction = getEnclosingFunction(node)
  if (enclosingFunction === null) {
    return false
  }

  if (!isComplexSignature(enclosingFunction)) {
    return false
  }

  return isWithinReturnedExpression(node, enclosingFunction)
}

/**
 * @param {string} filePath
 * @returns {boolean}
 */
const isConfigModuleFile = (filePath) =>
  filePath.includes(`/config/`) ||
  filePath.includes(`/configuration/`) ||
  filePath.includes(`/env/`) ||
  filePath.endsWith(`/config.ts`) ||
  filePath.endsWith(`/env.ts`) ||
  filePath.endsWith(`.config.ts`) ||
  filePath.endsWith(`.config.mts`) ||
  filePath.endsWith(`.config.cts`)

/**
 * @param {MemberExpression} memberExpression
 * @returns {boolean}
 */
const isProcessEnvMember = (memberExpression) => {
  if (getPropertyName(memberExpression) !== `env`) {
    return false
  }

  return isIdentifier(memberExpression.object) && memberExpression.object.name === `process`
}

/**
 * @param {Expression} expression
 * @returns {boolean}
 */
const isConsoleReference = (expression) => {
  if (isIdentifier(expression) && expression.name === `console`) {
    return true
  }

  if (!isMemberExpression(expression)) {
    return false
  }

  if (!isIdentifier(expression.object) || expression.object.name !== `globalThis`) {
    return false
  }

  return getPropertyName(expression) === `console`
}

/**
 * @param {string} filePath
 * @returns {boolean}
 */
const isEffectModuleFile = (filePath) =>
  filePath.includes(`/packages/`) && filePath.includes(`/src/`) && !isTestFilePath(filePath)

/**
 * @param {import('oxlint').ESTree.TSPropertySignature} propertySignature
 * @returns {boolean}
 */
const isTagProperty = (propertySignature) => {
  if (propertySignature.key.type === `Identifier`) {
    return propertySignature.key.name === `_tag`
  }

  return propertySignature.key.type === `Literal` && propertySignature.key.value === `_tag`
}

/**
 * @param {TSType} typeAnnotation
 * @returns {boolean}
 */
const isTaggedErrorType = (typeAnnotation) => {
  if (typeAnnotation.type === `TSNeverKeyword`) {
    return true
  }

  if (typeAnnotation.type === `TSParenthesizedType`) {
    return isTaggedErrorType(typeAnnotation.typeAnnotation)
  }

  if (typeAnnotation.type === `TSIntersectionType`) {
    return typeAnnotation.types.some(isTaggedErrorType)
  }

  if (typeAnnotation.type === `TSUnionType`) {
    return typeAnnotation.types.every(isTaggedErrorType)
  }

  if (typeAnnotation.type === `TSTypeLiteral`) {
    return typeAnnotation.members.some(
      (member) => member.type === `TSPropertySignature` && isTagProperty(member),
    )
  }

  if (typeAnnotation.type === `TSTypeReference`) {
    const typeName = getTypeName(typeAnnotation.typeName)
    return typeName !== null && (typeName.endsWith(`Error`) || typeName.endsWith(`Err`) || typeName.endsWith(`Failure`))
  }

  return false
}

/**
 * @param {import('oxlint').ESTree.CallExpression} callExpression
 * @returns {boolean}
 */
const isBoundaryInputCall = (callExpression) => {
  if (isIdentifier(callExpression.callee)) {
    return callExpression.callee.name === `readFile` || callExpression.callee.name === `readFileSync`
  }

  if (!isMemberExpression(callExpression.callee)) {
    return false
  }

  const propertyName = getPropertyName(callExpression.callee)
  if (propertyName === null) {
    return false
  }

  if (propertyName === `readFile` || propertyName === `readFileSync`) {
    return true
  }

  if (propertyName !== `json` && propertyName !== `text` && propertyName !== `formData`) {
    return false
  }

  if (!isIdentifier(callExpression.callee.object)) {
    return false
  }

  return (
    callExpression.callee.object.name === `request` ||
    callExpression.callee.object.name === `req` ||
    callExpression.callee.object.name === `response` ||
    callExpression.callee.object.name === `res`
  )
}

/**
 * @param {import('oxlint').ESTree.CallExpression} callExpression
 * @returns {boolean}
 */
const isSchemaDecodeCall = (callExpression) => {
  if (!isMemberExpression(callExpression.callee)) {
    return false
  }

  const propertyName = getPropertyName(callExpression.callee)
  if (propertyName === null || !propertyName.startsWith(`decode`)) {
    return false
  }

  return isIdentifier(callExpression.callee.object) && callExpression.callee.object.name === `Schema`
}

/**
 * @param {string} filePath
 * @returns {boolean}
 */
const isBoundaryModule = (filePath) => {
  if (isTestFilePath(filePath)) {
    return false
  }

  return (
    filePath.includes(`/env/`) ||
    filePath.includes(`/http/`) ||
    filePath.includes(`/file/`) ||
    filePath.includes(`/fs/`) ||
    filePath.includes(`/cli/`) ||
    filePath.includes(`/request/`) ||
    filePath.includes(`/handler/`) ||
    filePath.includes(`/route/`) ||
    filePath.includes(`/server/`)
  )
}

const noJsonParseRule = defineRule({
  meta: {
    type: `problem`,
    docs: {
      description: `Disallow JSON.parse in Effect-first modules.`,
      recommended: true,
    },
    messages: MESSAGES,
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!isMemberExpression(node.callee)) {
          return
        }

        if (getPropertyName(node.callee) !== `parse`) {
          return
        }

        if (!isJsonObjectReference(node.callee.object)) {
          return
        }

        context.report({
          node,
          messageId: MESSAGE_IDS.noJsonParse,
        })
      },
    }
  },
})

const noTryCatchRule = defineRule({
  meta: {
    type: `problem`,
    docs: {
      description: `Disallow try/catch in favor of typed Effect error channels.`,
      recommended: true,
    },
    messages: MESSAGES,
  },
  create(context) {
    const filePath = getNormalizedRelativePath(context)
    if (isTestFilePath(filePath) || isNonEffectPackage(filePath)) {
      return {}
    }

    return {
      TryStatement(node) {
        context.report({
          node,
          messageId: MESSAGE_IDS.noTryCatch,
        })
      },
    }
  },
})

const noNativePromiseConstructionRule = defineRule({
  meta: {
    type: `problem`,
    docs: {
      description: `Disallow native Promise construction in Effect-first modules.`,
      recommended: true,
    },
    messages: MESSAGES,
  },
  create(context) {
    return {
      NewExpression(node) {
        if (!isPromiseConstructorReference(node.callee)) {
          return
        }

        context.report({
          node,
          messageId: MESSAGE_IDS.noNativePromiseConstruction,
        })
      },
    }
  },
})

const noTypeAssertionRule = defineRule({
  meta: {
    type: `problem`,
    docs: {
      description: `Disallow TypeScript type assertions in Effect-first modules.`,
      recommended: true,
    },
    messages: MESSAGES,
  },
  create(context) {
    if (isTestFilePath(getNormalizedRelativePath(context))) {
      return {}
    }

    const isAsConstType = (typeAnnotation) =>
      (typeAnnotation.type === `TSTypeReference` &&
        typeAnnotation.typeName?.type === `Identifier` &&
        typeAnnotation.typeName.name === `const`) ||
      typeAnnotation.type === `TSConstKeyword`

    const isInsideFunction = (node) => {
      let current = node.parent
      while (current) {
        if (
          current.type === `FunctionDeclaration` ||
          current.type === `FunctionExpression` ||
          current.type === `ArrowFunctionExpression`
        ) {
          return true
        }
        current = current.parent
      }
      return false
    }

    return {
      TSAsExpression(node) {
        if (isAsConstType(node.typeAnnotation) && !isInsideFunction(node)) {
          return
        }
        if (isAllowedComplexReturnAnyAssertion(node)) {
          return
        }
        context.report({
          node,
          messageId: MESSAGE_IDS.noTypeAssertion,
        })
      },
      TSTypeAssertion(node) {
        if (isAllowedComplexReturnAnyAssertion(node)) {
          return
        }
        context.report({
          node,
          messageId: MESSAGE_IDS.noTypeAssertion,
        })
      },
    }
  },
})

const noNativeMapSetInEffectModulesRule = defineRule({
  meta: {
    type: `problem`,
    docs: {
      description: `Disallow Map/Set constructors and type annotations in packages/release/src.`,
      recommended: true,
    },
    messages: MESSAGES,
  },
  create(context) {
    if (!isReleaseEffectModule(getNormalizedRelativePath(context))) {
      return {}
    }

    return {
      NewExpression(node) {
        if (!isIdentifier(node.callee)) {
          return
        }

        if (node.callee.name !== `Map` && node.callee.name !== `Set`) {
          return
        }

        context.report({
          node,
          messageId: MESSAGE_IDS.noNativeMapSetInEffectModules,
        })
      },
      TSTypeReference(node) {
        const typeName = getTypeName(node.typeName)
        if (typeName !== `Map` && typeName !== `Set`) {
          return
        }

        context.report({
          node,
          messageId: MESSAGE_IDS.noNativeMapSetInEffectModules,
        })
      },
    }
  },
})

const noNodejsBuiltinImportsRule = defineRule({
  meta: {
    type: `problem`,
    docs: {
      description: `Disallow Node.js built-ins and non-Effect fs/path helper imports.`,
      recommended: true,
    },
    messages: MESSAGES,
  },
  create(context) {
    const nodeBuiltinImportsAllowed = isNodeBuiltinImportAllowedInFile(context.filename)

    const maybeReport = (specifierNode, importPath) => {
      if (isDisallowedEffectPlatformAlternativePath(importPath)) {
        context.report({
          node: specifierNode,
          messageId: MESSAGE_IDS.noNodejsBuiltinImports,
        })
        return
      }

      if (!isNodeBuiltinImportPath(importPath) || nodeBuiltinImportsAllowed) {
        return
      }

      context.report({
        node: specifierNode,
        messageId: MESSAGE_IDS.noNodejsBuiltinImports,
      })
    }

    return {
      ImportDeclaration(node) {
        const importPath = getStringLiteralValue(node.source)
        if (importPath !== null) {
          maybeReport(node.source, importPath)
        }
      },
      ExportNamedDeclaration(node) {
        if (node.source === null) {
          return
        }

        const importPath = getStringLiteralValue(node.source)
        if (importPath !== null) {
          maybeReport(node.source, importPath)
        }
      },
      ExportAllDeclaration(node) {
        const importPath = getStringLiteralValue(node.source)
        if (importPath !== null) {
          maybeReport(node.source, importPath)
        }
      },
      ImportExpression(node) {
        const importPath = getStringLiteralValue(node.source)
        if (importPath !== null) {
          maybeReport(node.source, importPath)
        }
      },
      CallExpression(node) {
        if (!isIdentifier(node.callee) || node.callee.name !== `require`) {
          return
        }

        if (node.arguments.length === 0) {
          return
        }

        const importPath = getStringLiteralValue(node.arguments[0])
        if (importPath !== null) {
          maybeReport(node.arguments[0], importPath)
        }
      },
    }
  },
})

const noThrowRule = defineRule({
  meta: {
    type: `problem`,
    docs: {
      description: `Disallow throw in non-boundary modules.`,
      recommended: true,
    },
    messages: MESSAGES,
  },
  create(context) {
    const filePath = getNormalizedRelativePath(context)
    if (isBoundaryAdapterFile(filePath) || isNonEffectPackage(filePath)) {
      return {}
    }

    return {
      ThrowStatement(node) {
        context.report({
          node,
          messageId: MESSAGE_IDS.noThrow,
        })
      },
    }
  },
})

const noPromiseThenChainRule = defineRule({
  meta: {
    type: `problem`,
    docs: {
      description: `Disallow Promise then/catch/finally chains in favor of Effect composition.`,
      recommended: true,
    },
    messages: MESSAGES,
  },
  create(context) {
    const filePath = getNormalizedRelativePath(context)
    if (isBoundaryAdapterFile(filePath) || isNonEffectPackage(filePath)) {
      return {}
    }

    return {
      CallExpression(node) {
        if (!isMemberExpression(node.callee)) {
          return
        }

        const propertyName = getPropertyName(node.callee)
        if (propertyName !== `then` && propertyName !== `catch` && propertyName !== `finally`) {
          return
        }

        context.report({
          node,
          messageId: MESSAGE_IDS.noPromiseThenChain,
        })
      },
    }
  },
})

const noEffectRunInLibraryCodeRule = defineRule({
  meta: {
    type: `problem`,
    docs: {
      description: `Disallow Effect.run* calls outside app/CLI entrypoints and tests.`,
      recommended: true,
    },
    messages: MESSAGES,
  },
  create(context) {
    if (isEffectRunAllowedFile(getNormalizedRelativePath(context))) {
      return {}
    }

    return {
      CallExpression(node) {
        if (!isMemberExpression(node.callee)) {
          return
        }

        if (!isEffectReference(node.callee.object)) {
          return
        }

        if (!isEffectRunMethodName(getPropertyName(node.callee))) {
          return
        }

        context.report({
          node,
          messageId: MESSAGE_IDS.noEffectRunInLibraryCode,
        })
      },
    }
  },
})

const requireTypedEffectErrorsRule = defineRule({
  meta: {
    type: `problem`,
    docs: {
      description: `Require explicit, non-any/unknown typed Effect error channels.`,
      recommended: true,
    },
    messages: MESSAGES,
  },
  create(context) {
    return {
      TSTypeReference(node) {
        if (!isEffectTypeName(node.typeName)) {
          return
        }

        if (node.typeArguments === null || node.typeArguments.params.length < 2) {
          return
        }

        const errorType = node.typeArguments.params[1]
        if (!errorType || !isAnyOrUnknownType(errorType)) {
          return
        }

        context.report({
          node: errorType,
          messageId: MESSAGE_IDS.requireTypedEffectErrors,
        })
      },
    }
  },
})

const requireSchemaDecodeAtBoundaryRule = defineRule({
  meta: {
    type: `problem`,
    docs: {
      description: `Require Effect Schema decode usage in boundary modules reading env/http/file input.`,
      recommended: true,
    },
    messages: MESSAGES,
  },
  create(context) {
    if (!isBoundaryModule(getNormalizedRelativePath(context))) {
      return {}
    }

    let hasBoundaryInputUsage = false
    let hasSchemaDecodeUsage = false

    return {
      MemberExpression(node) {
        if (isProcessEnvMember(node)) {
          hasBoundaryInputUsage = true
        }
      },
      CallExpression(node) {
        if (isBoundaryInputCall(node)) {
          hasBoundaryInputUsage = true
        }

        if (isSchemaDecodeCall(node)) {
          hasSchemaDecodeUsage = true
        }
      },
      'Program:exit'(node) {
        if (!hasBoundaryInputUsage || hasSchemaDecodeUsage) {
          return
        }

        context.report({
          node,
          messageId: MESSAGE_IDS.requireSchemaDecodeAtBoundary,
        })
      },
    }
  },
})

const noProcessEnvOutsideConfigModulesRule = defineRule({
  meta: {
    type: `problem`,
    docs: {
      description: `Disallow process.env usage outside config/env modules.`,
      recommended: true,
    },
    messages: MESSAGES,
  },
  create(context) {
    const filePath = getNormalizedRelativePath(context)
    if (isTestFilePath(filePath) || isConfigModuleFile(filePath)) {
      return {}
    }

    return {
      MemberExpression(node) {
        if (!isProcessEnvMember(node)) {
          return
        }

        context.report({
          node,
          messageId: MESSAGE_IDS.noProcessEnvOutsideConfigModules,
        })
      },
    }
  },
})

const noDateNowInDomainRule = defineRule({
  meta: {
    type: `problem`,
    docs: {
      description: `Disallow Date.now in domain/library code.`,
      recommended: true,
    },
    messages: MESSAGES,
  },
  create(context) {
    if (isBoundaryAdapterFile(getNormalizedRelativePath(context))) {
      return {}
    }

    return {
      CallExpression(node) {
        if (!isMemberExpression(node.callee)) {
          return
        }

        if (getPropertyName(node.callee) !== `now`) {
          return
        }

        if (!isDateConstructorReference(node.callee.object)) {
          return
        }

        context.report({
          node,
          messageId: MESSAGE_IDS.noDateNowInDomain,
        })
      },
    }
  },
})

const noMathRandomInDomainRule = defineRule({
  meta: {
    type: `problem`,
    docs: {
      description: `Disallow Math.random in domain/library code.`,
      recommended: true,
    },
    messages: MESSAGES,
  },
  create(context) {
    if (isBoundaryAdapterFile(getNormalizedRelativePath(context))) {
      return {}
    }

    return {
      CallExpression(node) {
        if (!isMemberExpression(node.callee)) {
          return
        }

        if (getPropertyName(node.callee) !== `random`) {
          return
        }

        if (!isMathObjectReference(node.callee.object)) {
          return
        }

        context.report({
          node,
          messageId: MESSAGE_IDS.noMathRandomInDomain,
        })
      },
    }
  },
})

const noConsoleInEffectModulesRule = defineRule({
  meta: {
    type: `problem`,
    docs: {
      description: `Disallow console usage in Effect modules.`,
      recommended: true,
    },
    messages: MESSAGES,
  },
  create(context) {
    const filePath = getNormalizedRelativePath(context)
    if (!isEffectModuleFile(filePath) || isBoundaryAdapterFile(filePath)) {
      return {}
    }

    return {
      CallExpression(node) {
        if (!isMemberExpression(node.callee)) {
          return
        }

        const methodName = getPropertyName(node.callee)
        if (
          methodName !== `log` &&
          methodName !== `error` &&
          methodName !== `warn` &&
          methodName !== `info` &&
          methodName !== `debug` &&
          methodName !== `trace`
        ) {
          return
        }

        if (!isConsoleReference(node.callee.object)) {
          return
        }

        context.report({
          node,
          messageId: MESSAGE_IDS.noConsoleInEffectModules,
        })
      },
    }
  },
})

const requireTaggedErrorTypesRule = defineRule({
  meta: {
    type: `problem`,
    docs: {
      description: `Require _tag in Effect error channel types for pattern matching.`,
      recommended: true,
    },
    messages: MESSAGES,
  },
  create(context) {
    return {
      TSTypeReference(node) {
        if (!isEffectTypeName(node.typeName)) {
          return
        }

        if (node.typeArguments === null || node.typeArguments.params.length < 2) {
          return
        }

        const errorType = node.typeArguments.params[1]
        if (!errorType || errorType.type === `TSAnyKeyword` || errorType.type === `TSUnknownKeyword`) {
          return
        }

        if (isTaggedErrorType(errorType)) {
          return
        }

        context.report({
          node: errorType,
          messageId: MESSAGE_IDS.requireTaggedErrorTypes,
        })
      },
    }
  },
})

const namespaceFileConventionsRule = defineRule({
  meta: {
    type: `problem`,
    docs: {
      description: `Enforce _.ts namespace file conventions.`,
      recommended: true,
    },
    messages: MESSAGES,
  },
  create(context) {
    const filePath = getNormalizedRelativePath(context)
    if (!filePath.endsWith(`/_.ts`)) {
      return {}
    }

    const namespaceFileConvention = getNamespaceFileConvention(filePath, context.cwd)
    if (namespaceFileConvention === null) {
      return {}
    }

    return {
      Program(node) {
        /** @type {Array<{ statement: Statement, namespaceExport: NamespaceExport }>} */
        const namespaceExports = []
        /** @type {Array<{ statement: Statement, namespaceName: string, isEmpty: boolean }>} */
        const namespaceDeclarations = []
        /** @type {Array<{ typeName: string, node: unknown }>} */
        const inFileExportedTypeDeclarations = []

        for (const statement of node.body) {
          const namespaceExport = getNamespaceExportFromStatement(statement)
          if (namespaceExport !== null) {
            namespaceExports.push({ statement, namespaceExport })
            continue
          }

          const namespaceDeclaration = getNamespaceDeclarationFromStatement(statement)
          if (namespaceDeclaration !== null) {
            namespaceDeclarations.push({
              statement,
              namespaceName: namespaceDeclaration.namespaceName,
              isEmpty: namespaceDeclaration.isEmpty,
            })
            if (!namespaceDeclaration.isEmpty) {
              context.report({
                node: statement,
                messageId: MESSAGE_IDS.namespaceFileConventionsNamespaceDeclaration,
              })
            }
            continue
          }

          if (isTypeOnlyExportStatement(statement)) {
            inFileExportedTypeDeclarations.push(...getInFileExportedTypeDeclarations(statement))
            continue
          }

          context.report({
            node: statement,
            messageId: MESSAGE_IDS.namespaceFileConventionsSingleStatement,
          })
          return
        }

        if (namespaceExports.length !== 1) {
          context.report({
            node,
            messageId: MESSAGE_IDS.namespaceFileConventionsNamespaceExport,
          })
          return
        }

        const [namespaceExportStatement] = namespaceExports
        for (const inFileExportedTypeDeclaration of inFileExportedTypeDeclarations) {
          if (inFileExportedTypeDeclaration.typeName === namespaceExportStatement.namespaceExport.namespaceName) {
            continue
          }

          context.report({
            node: inFileExportedTypeDeclaration.node,
            messageId: MESSAGE_IDS.namespaceFileConventionsTypeDeclarationName,
          })
        }

        if (
          namespaceExportStatement.namespaceExport.namespaceName !==
          namespaceFileConvention.expectedNamespaceName
        ) {
          context.report({
            node: namespaceExportStatement.statement,
            messageId: MESSAGE_IDS.namespaceFileConventionsNamespaceName,
          })
        }

        const expectedTargetPath = namespaceFileConvention.expectedTargetPath
        const actualTargetPath = namespaceExportStatement.namespaceExport.sourcePath
        if (
          (expectedTargetPath !== null && actualTargetPath !== expectedTargetPath) ||
          (expectedTargetPath === null && !isValidNamespaceTargetPath(actualTargetPath))
        ) {
          context.report({
            node: namespaceExportStatement.statement,
            messageId: MESSAGE_IDS.namespaceFileConventionsTarget,
          })
        }

        if (namespaceDeclarations.length === 0) {
          context.report({
            node,
            messageId: MESSAGE_IDS.namespaceFileConventionsNamespaceDeclaration,
          })
          return
        }

        const matchingNamespaceDeclarations = namespaceDeclarations.filter((namespaceDeclaration) =>
          namespaceDeclaration.namespaceName === namespaceFileConvention.expectedNamespaceName)
        if (matchingNamespaceDeclarations.length === 0) {
          context.report({
            node: namespaceDeclarations[0].statement,
            messageId: MESSAGE_IDS.namespaceFileConventionsNamespaceDeclarationName,
          })
          return
        }

        const hasMatchingEmptyNamespaceDeclaration = matchingNamespaceDeclarations.some(
          (namespaceDeclaration) => namespaceDeclaration.isEmpty,
        )
        if (!hasMatchingEmptyNamespaceDeclaration) {
          context.report({
            node: matchingNamespaceDeclarations[0].statement,
            messageId: MESSAGE_IDS.namespaceFileConventionsNamespaceDeclaration,
          })
          return
        }

        const sourceText = fs.readFileSync(context.filename, `utf8`)
        if (!hasNamespaceDeclarationWithJsDoc(sourceText, namespaceFileConvention.expectedNamespaceName)) {
          context.report({
            node: matchingNamespaceDeclarations[0].statement,
            messageId: MESSAGE_IDS.namespaceFileConventionsNamespaceDeclarationJsDoc,
          })
        }
      },
    }
  },
})

const barrelFileConventionsRule = defineRule({
  meta: {
    type: `problem`,
    docs: {
      description: `Enforce __.ts barrel file conventions.`,
      recommended: true,
    },
    messages: MESSAGES,
  },
  create(context) {
    const filePath = getNormalizedRelativePath(context)
    if (!filePath.endsWith(`/__.ts`)) {
      return {}
    }

    const directoryState = readModuleDirectoryState(path.dirname(context.filename))
    const hasPeerImplementationFiles =
      directoryState !== null && directoryState.implementationFiles.length > 0

    return {
      Program(node) {
        if (!hasPeerImplementationFiles) {
          for (const statement of node.body) {
            if (statement.type !== `ExportDefaultDeclaration`) {
              continue
            }

            context.report({
              node: statement,
              messageId: MESSAGE_IDS.barrelFileConventionsDefaultExport,
            })
          }

          return
        }

        let hasAnyExport = false

        for (const statement of node.body) {
          if (statement.type === `ImportDeclaration`) {
            continue
          }

          if (statement.type === `ExportDefaultDeclaration`) {
            context.report({
              node: statement,
              messageId: MESSAGE_IDS.barrelFileConventionsDefaultExport,
            })
            hasAnyExport = true
            continue
          }

          if (statement.type === `ExportAllDeclaration` || statement.type === `ExportNamedDeclaration`) {
            hasAnyExport = true
            continue
          }

          context.report({
            node: statement,
            messageId: MESSAGE_IDS.barrelFileConventionsOnlyImportExport,
          })
          return
        }

        if (!hasAnyExport) {
          context.report({
            node,
            messageId: MESSAGE_IDS.barrelFileConventionsMissingExport,
          })
        }
      },
    }
  },
})

const moduleStructureConventionsRule = defineRule({
  meta: {
    type: `problem`,
    docs: {
      description: `Enforce module directory structure and _.ts/__.ts elision conventions.`,
      recommended: true,
    },
    messages: MESSAGES,
  },
  create(context) {
    const filePath = getNormalizedRelativePath(context)
    const packageSourcePathDetails = getPackageSourcePathDetails(filePath)
    if (packageSourcePathDetails === null) {
      return {}
    }

    return {
      Program(node) {
        const packageRootIssueKey = `${normalizePath(context.cwd)}:${packageSourcePathDetails.packageSourceDirectoryRelativePath}`
        if (!reportedMissingRootEntrypoints.has(packageRootIssueKey)) {
          reportedMissingRootEntrypoints.add(packageRootIssueKey)
          const packageSourceDirectory = path.join(
            context.cwd,
            packageSourcePathDetails.packageSourceDirectoryRelativePath,
          )
          const hasNamespaceEntrypoint = fs.existsSync(path.join(packageSourceDirectory, `_.ts`))
          const hasBarrelEntrypoint = fs.existsSync(path.join(packageSourceDirectory, `__.ts`))

          if (!hasNamespaceEntrypoint || !hasBarrelEntrypoint) {
            context.report({
              node,
              messageId: MESSAGE_IDS.moduleStructureConventionsRootEntrypoints,
            })
          }
        }

        if (!filePath.endsWith(`/_.ts`)) {
          return
        }

        const directoryState = readModuleDirectoryState(path.dirname(context.filename))
        if (directoryState === null) {
          return
        }

        const namespaceExport = getNamespaceExportFromProgram(node)
        const implementationCount = directoryState.implementationFiles.length

        if (implementationCount > 1) {
          if (!directoryState.hasBarrel) {
            context.report({
              node,
              messageId: MESSAGE_IDS.moduleStructureConventionsMissingBarrel,
            })
          }

          if (namespaceExport !== null && namespaceExport.sourcePath !== `./__.js`) {
            context.report({
              node,
              messageId: MESSAGE_IDS.moduleStructureConventionsMultiFileNamespaceTarget,
            })
          }

          return
        }

        if (implementationCount === 1 && !directoryState.hasBarrel && namespaceExport !== null) {
          const expectedRuntimeTarget = `./${toModuleRuntimeFileName(directoryState.implementationFiles[0])}`
          if (namespaceExport.sourcePath !== expectedRuntimeTarget) {
            context.report({
              node,
              messageId: MESSAGE_IDS.moduleStructureConventionsSingleFileNamespaceTarget,
            })
          }
        }
      },
    }
  },
})

// ---------------------------------------------------------------------------
// Helpers: no-deep-imports-when-namespace-entrypoint-exists
// ---------------------------------------------------------------------------

/** @type {Map<string, boolean>} */
const directoryHasNamespaceEntrypointCache = new Map()

/**
 * Check if a directory contains a `_.ts` file (namespace entrypoint).
 * Result is cached for performance.
 * @param {string} absoluteDir
 * @returns {boolean}
 */
const directoryHasNamespaceEntrypoint = (absoluteDir) => {
  const cached = directoryHasNamespaceEntrypointCache.get(absoluteDir)
  if (cached !== undefined) return cached
  const exists = fs.existsSync(path.join(absoluteDir, `_.ts`))
  directoryHasNamespaceEntrypointCache.set(absoluteDir, exists)
  return exists
}

/**
 * Resolve a relative import specifier to an absolute file path.
 * Maps `.js` → `.ts` for source resolution. Returns null if not resolvable.
 * @param {string} importSpecifier - The import specifier (e.g. `./bar/impl.js`)
 * @param {string} importerAbsolutePath - Absolute path of the importing file
 * @returns {string | null} Absolute path to the resolved .ts file, or null
 */
const resolveRelativeImport = (importSpecifier, importerAbsolutePath) => {
  if (!importSpecifier.startsWith(`.`)) return null
  const importerDir = path.dirname(importerAbsolutePath)
  const resolved = path.resolve(importerDir, importSpecifier)
  // Map .js → .ts for source resolution
  const tsPath = resolved.replace(/\.js$/, `.ts`)
  if (fs.existsSync(tsPath)) return tsPath
  // Also try the original path (e.g. .ts imports)
  if (fs.existsSync(resolved)) return resolved
  return null
}

/**
 * Check if a relative import violates the namespace boundary rule.
 * Walks upward from the target's directory to the importer's scope boundary,
 * looking for any `_.ts` that creates a wall.
 *
 * @param {string} importSpecifier - The import specifier string
 * @param {string} importerAbsolutePath - Absolute path of the importing file
 * @param {string} packageSourceDir - Absolute path to the package src/ directory
 * @returns {{ violatingDir: string } | null} - The directory with the wall, or null if no violation
 */
const getDeepImportViolation = (importSpecifier, importerAbsolutePath, packageSourceDir) => {
  if (!importSpecifier.startsWith(`.`)) return null

  const resolved = resolveRelativeImport(importSpecifier, importerAbsolutePath)
  if (resolved === null) return null

  const resolvedNormalized = normalizePath(resolved)
  const targetBasename = path.basename(resolvedNormalized)

  // If the target IS a _.ts or __.ts file, that's going "through the door" — allowed
  if (targetBasename === `_.ts` || targetBasename === `__.ts`) return null

  const importerDir = normalizePath(path.dirname(importerAbsolutePath))
  const targetDir = normalizePath(path.dirname(resolved))

  // If importer and target are in the same directory, they're peers — allowed
  if (importerDir === targetDir) return null

  // Walk upward from targetDir checking for _.ts walls.
  // A wall blocks access from OUTSIDE the namespace. Files that are descendants
  // of the wall's directory are INSIDE the namespace (like lexical scope) and
  // can import freely within it.
  const normalizedPackageSourceDir = normalizePath(packageSourceDir)
  let dir = targetDir

  while (dir.length >= normalizedPackageSourceDir.length) {
    if (directoryHasNamespaceEntrypoint(dir)) {
      // This directory has a _.ts wall.
      const importerBasename = path.basename(importerAbsolutePath)
      const importerDirNormalized = normalizePath(path.dirname(importerAbsolutePath))

      // If the importer is the __.ts file in the same directory as the _.ts wall — allowed
      // (the barrel aggregates files within its own scope)
      if (importerBasename === `__.ts` && importerDirNormalized === dir) return null

      // If the importer is a descendant of the wall's directory, it's inside the
      // namespace — allowed (like lexical scope: you can see what's above you)
      if (importerDirNormalized.startsWith(dir + `/`) || importerDirNormalized === dir) return null

      return { violatingDir: dir }
    }
    const parent = normalizePath(path.dirname(dir))
    if (parent === dir) break // reached filesystem root
    dir = parent
  }

  return null
}

// ---------------------------------------------------------------------------
// Rule: no-deep-imports-when-namespace-entrypoint-exists
// ---------------------------------------------------------------------------

const noDeepImportsWhenNamespaceEntrypointExistsRule = defineRule({
  meta: {
    type: `problem`,
    docs: {
      description: `Forbid importing past a namespace boundary (_.ts) via relative paths.`,
      recommended: true,
    },
    messages: MESSAGES,
  },
  create(context) {
    const filePath = getNormalizedRelativePath(context)

    // Test files are exempt
    if (isTestFilePath(filePath)) return {}

    const details = getPackageSourcePathDetails(filePath)
    if (details === null) return {}

    const packageSourceDir = path.resolve(context.cwd, details.packageSourceDirectoryRelativePath)

    /**
     * Check an import/export source for deep import violation.
     * @param {unknown} node - The AST node to report on
     * @param {unknown} sourceNode - The source literal node
     */
    const checkImportSource = (node, sourceNode) => {
      const specifier = getStringLiteralValue(sourceNode)
      if (specifier === null || !specifier.startsWith(`.`)) return

      const violation = getDeepImportViolation(specifier, context.filename, packageSourceDir)
      if (violation !== null) {
        context.report({
          node,
          messageId: MESSAGE_IDS.noDeepImportsWhenNamespaceEntrypointExists,
        })
      }
    }

    return {
      ImportDeclaration(node) {
        checkImportSource(node, node.source)
      },
      ExportNamedDeclaration(node) {
        if (node.source) {
          checkImportSource(node, node.source)
        }
      },
      ExportAllDeclaration(node) {
        checkImportSource(node, node.source)
      },
      ImportExpression(node) {
        checkImportSource(node, node.source)
      },
    }
  },
})

// ---------------------------------------------------------------------------
// Helpers: prefer-subpath-imports
// ---------------------------------------------------------------------------

/** @type {Map<string, Map<string, string> | null>} */
const subpathImportReverseMapCache = new Map()

/**
 * Build a reverse map from resolved import target paths to their # keys.
 * Only string values are included (conditional imports are skipped).
 * Returns null if no imports field exists.
 *
 * @param {string} packageDir - Absolute path to the package directory
 * @returns {Map<string, string> | null}
 */
const getSubpathImportReverseMap = (packageDir) => {
  const cached = subpathImportReverseMapCache.get(packageDir)
  if (cached !== undefined) return cached

  const packageJsonPath = path.join(packageDir, `package.json`)
  if (!fs.existsSync(packageJsonPath)) {
    subpathImportReverseMapCache.set(packageDir, null)
    return null
  }

  try {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, `utf8`))
    if (!pkg.imports || typeof pkg.imports !== `object`) {
      subpathImportReverseMapCache.set(packageDir, null)
      return null
    }

    /** @type {Map<string, string>} */
    const reverseMap = new Map()
    for (const [key, value] of Object.entries(pkg.imports)) {
      if (typeof value === `string`) {
        // Normalize: resolve the value relative to packageDir to get absolute path
        const absoluteTarget = normalizePath(path.resolve(packageDir, value))
        reverseMap.set(absoluteTarget, key)
      }
    }

    subpathImportReverseMapCache.set(packageDir, reverseMap)
    return reverseMap
  } catch {
    subpathImportReverseMapCache.set(packageDir, null)
    return null
  }
}

// ---------------------------------------------------------------------------
// Rule: prefer-subpath-imports
// ---------------------------------------------------------------------------

const preferSubpathImportsRule = defineRule({
  meta: {
    type: `suggestion`,
    docs: {
      description: `Prefer # subpath imports over relative paths to _.ts/__.ts doors when a matching subpath exists.`,
      recommended: true,
    },
    messages: MESSAGES,
  },
  create(context) {
    const filePath = getNormalizedRelativePath(context)

    // Test files are exempt
    if (isTestFilePath(filePath)) return {}

    // Structural files (_.ts namespace entrypoints and __.ts barrels) are exempt —
    // they define the module tree and must use relative imports
    const basename = path.basename(context.filename)
    if (basename === `_.ts` || basename === `__.ts`) return {}

    const details = getPackageSourcePathDetails(filePath)
    if (details === null) return {}

    // Compute the package directory (parent of src/)
    const packageDir = path.resolve(context.cwd, details.packageSourceDirectoryRelativePath, `..`)
    const reverseMap = getSubpathImportReverseMap(packageDir)
    if (reverseMap === null || reverseMap.size === 0) return {}

    /**
     * Check if a relative import to a door file has a # subpath alternative.
     * @param {unknown} node
     * @param {unknown} sourceNode
     */
    const checkForSubpathAlternative = (node, sourceNode) => {
      const specifier = getStringLiteralValue(sourceNode)
      if (specifier === null || !specifier.startsWith(`.`)) return

      const resolved = resolveRelativeImport(specifier, context.filename)
      if (resolved === null) return

      const resolvedBasename = path.basename(resolved)
      // Only check imports targeting door files (_.ts or __.ts)
      if (resolvedBasename !== `_.ts` && resolvedBasename !== `__.ts`) return

      // Skip same-directory imports — intra-module imports to own barrel/namespace are structural
      const importerDir = normalizePath(path.dirname(context.filename))
      const targetDir = normalizePath(path.dirname(resolved))
      if (importerDir === targetDir) return

      const normalizedResolved = normalizePath(resolved)

      // Check if any subpath import maps to this resolved path
      if (reverseMap.has(normalizedResolved)) {
        context.report({
          node,
          messageId: MESSAGE_IDS.preferSubpathImports,
        })
      }
    }

    return {
      ImportDeclaration(node) {
        checkForSubpathAlternative(node, node.source)
      },
      ExportNamedDeclaration(node) {
        if (node.source) {
          checkForSubpathAlternative(node, node.source)
        }
      },
      ExportAllDeclaration(node) {
        checkForSubpathAlternative(node, node.source)
      },
      ImportExpression(node) {
        checkForSubpathAlternative(node, node.source)
      },
    }
  },
})

// ---------------------------------------------------------------------------
// subpath-imports-integrity
// ---------------------------------------------------------------------------

/** @type {Map<string, Map<string, string | object> | null>} */
const subpathImportForwardMapCache = new Map()

/**
 * Returns a forward map of subpath import key → raw target value (string or object).
 * Unlike the reverse map, this preserves the original target for format checking.
 * @param {string} packageDir
 * @returns {Map<string, string | object> | null}
 */
const getSubpathImportForwardMap = (packageDir) => {
  const cached = subpathImportForwardMapCache.get(packageDir)
  if (cached !== undefined) return cached

  const packageJsonPath = path.join(packageDir, `package.json`)
  if (!fs.existsSync(packageJsonPath)) {
    subpathImportForwardMapCache.set(packageDir, null)
    return null
  }

  try {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, `utf8`))
    if (!pkg.imports || typeof pkg.imports !== `object`) {
      subpathImportForwardMapCache.set(packageDir, null)
      return null
    }

    /** @type {Map<string, string | object>} */
    const forwardMap = new Map()
    for (const [key, value] of Object.entries(pkg.imports)) {
      forwardMap.set(key, value)
    }

    subpathImportForwardMapCache.set(packageDir, forwardMap)
    return forwardMap
  } catch {
    subpathImportForwardMapCache.set(packageDir, null)
    return null
  }
}

/**
 * Transforms package.json imports into tsconfig.json paths format.
 * Skips #kitz/* entries (manually maintained) and conditional imports (object values).
 * @param {Map<string, string | object>} forwardMap
 * @returns {Record<string, string[]>}
 */
const transformImportsToPaths = (forwardMap) => {
  /** @type {Record<string, string[]>} */
  const paths = {}
  for (const [key, value] of forwardMap) {
    // Skip #kitz/* patterns — manually maintained for circular devDep workaround
    if (key.startsWith(`#kitz/`)) continue
    // Skip conditional imports (objects with browser/default/etc conditions)
    if (typeof value !== `string`) continue
    // Package.json imports point at source (.ts), tsconfig paths need .js extension
    const tsconfigPath = value.replace(/\.ts$/, `.js`)
    paths[key] = [tsconfigPath]
  }
  return paths
}

/** @type {Set<string>} */
const reportedSubpathImportsIntegrity = new Set()

const subpathImportsIntegrityRule = defineRule({
  meta: {
    type: `problem`,
    docs: {
      description: `Validate that package.json subpath import declarations are consistent with the filesystem and tsconfig.`,
      recommended: true,
    },
    messages: MESSAGES,
  },
  create(context) {
    const filePath = getNormalizedRelativePath(context)
    const packageSourcePathDetails = getPackageSourcePathDetails(filePath)
    if (packageSourcePathDetails === null) {
      return {}
    }

    return {
      Program(node) {
        const packageDir = path.resolve(context.cwd, packageSourcePathDetails.packageSourceDirectoryRelativePath, `..`)
        const packageKey = normalizePath(packageDir)

        // --- Per-file check: missing entry (Check 3) ---
        // Only applies to _.ts files
        if (filePath.endsWith(`/_.ts`)) {
          const absolutePath = normalizePath(path.resolve(context.cwd, filePath))
          const reverseMap = getSubpathImportReverseMap(packageDir)
          if (reverseMap !== null && reverseMap.size > 0 && !reverseMap.has(absolutePath)) {
            context.report({
              node,
              messageId: MESSAGE_IDS.subpathImportsIntegrityMissingEntry,
            })
          }
        }

        // --- Per-package checks (deduped): broken ref, wrong format, condition mismatch, tsconfig drift ---
        if (reportedSubpathImportsIntegrity.has(packageKey)) {
          return
        }
        reportedSubpathImportsIntegrity.add(packageKey)

        const forwardMap = getSubpathImportForwardMap(packageDir)
        if (forwardMap === null || forwardMap.size === 0) {
          return
        }

        for (const [, value] of forwardMap) {
          if (typeof value === `string`) {
            // Check 2: Wrong format — string targets should use ./src/*.ts format
            if (!value.startsWith(`./src/`)) {
              context.report({
                node,
                messageId: MESSAGE_IDS.subpathImportsIntegrityWrongFormat,
              })
            }

            // Check 1: Broken ref — non-wildcard string targets must resolve to existing files
            if (!value.includes(`*`)) {
              const absoluteTarget = path.resolve(packageDir, value)
              if (!fs.existsSync(absoluteTarget)) {
                context.report({
                  node,
                  messageId: MESSAGE_IDS.subpathImportsIntegrityBrokenRef,
                })
              }
            }
          } else if (typeof value === `object` && value !== null) {
            // Check 4: Condition mismatch — condition keys should match target filenames
            for (const [condition, target] of Object.entries(value)) {
              // Skip 'default' — it's a catch-all keyword, not a runtime name
              if (condition === `default`) continue
              if (typeof target === `string` && !target.includes(`.${condition}.`)) {
                context.report({
                  node,
                  messageId: MESSAGE_IDS.subpathImportsIntegrityConditionMismatch,
                })
              }
            }
          }
        }

        // Check 5: Tsconfig drift — compare tsconfig paths against expected from imports
        const tsconfigPath = path.join(packageDir, `tsconfig.json`)
        if (fs.existsSync(tsconfigPath)) {
          try {
            const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, `utf8`))
            const expectedPaths = transformImportsToPaths(forwardMap)
            const currentPaths = (tsconfig.compilerOptions?.paths ?? {})

            // Preserve existing #kitz/* paths (manually maintained)
            /** @type {Record<string, string[]>} */
            const preservedKitzPaths = {}
            for (const [k, v] of Object.entries(currentPaths)) {
              if (k.startsWith(`#kitz/`)) {
                preservedKitzPaths[k] = v
              }
            }

            // Build merged expected (synced from imports + preserved #kitz/*)
            const mergedExpected = { ...expectedPaths, ...preservedKitzPaths }

            // Compare
            const mergedJson = JSON.stringify(mergedExpected, null, 2)
            const currentJson = JSON.stringify(currentPaths, null, 2)

            if (mergedJson !== currentJson) {
              context.report({
                node,
                messageId: MESSAGE_IDS.subpathImportsIntegrityTsconfigDrift,
              })

              // Auto-fix: write corrected tsconfig
              tsconfig.compilerOptions = tsconfig.compilerOptions ?? {}
              tsconfig.compilerOptions.paths = mergedExpected
              fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2) + `\n`)
            }
          } catch {
            // Ignore malformed tsconfig
          }
        }
      },
    }
  },
})

export default definePlugin({
  meta: {
    name: `kitz`,
  },
  rules: {
    'no-json-parse': noJsonParseRule,
    'no-try-catch': noTryCatchRule,
    'no-native-promise-construction': noNativePromiseConstructionRule,
    'no-type-assertion': noTypeAssertionRule,
    'no-native-map-set-in-effect-modules': noNativeMapSetInEffectModulesRule,
    'no-nodejs-builtin-imports': noNodejsBuiltinImportsRule,
    'no-throw': noThrowRule,
    'no-promise-then-chain': noPromiseThenChainRule,
    'no-effect-run-in-library-code': noEffectRunInLibraryCodeRule,
    'require-typed-effect-errors': requireTypedEffectErrorsRule,
    'require-schema-decode-at-boundary': requireSchemaDecodeAtBoundaryRule,
    'no-process-env-outside-config-modules': noProcessEnvOutsideConfigModulesRule,
    'no-date-now-in-domain': noDateNowInDomainRule,
    'no-math-random-in-domain': noMathRandomInDomainRule,
    'no-console-in-effect-modules': noConsoleInEffectModulesRule,
    'require-tagged-error-types': requireTaggedErrorTypesRule,
    'namespace-file-conventions': namespaceFileConventionsRule,
    'barrel-file-conventions': barrelFileConventionsRule,
    'module-structure-conventions': moduleStructureConventionsRule,
    'no-deep-imports-when-namespace-entrypoint-exists': noDeepImportsWhenNamespaceEntrypointExistsRule,
    'prefer-subpath-imports': preferSubpathImportsRule,
    'subpath-imports-integrity': subpathImportsIntegrityRule,
  },
})
