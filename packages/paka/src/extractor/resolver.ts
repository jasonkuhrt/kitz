import { ResolverFactory } from 'oxc-resolver'
import { isAbsolute, join, relative } from 'path'
import { type Project, type SourceFile } from 'ts-morph'

const esmConditionNames = ['node', 'import'] as const

const resolverExtensions = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs', '.json']

const resolverExtensionAlias = {
  '.js': ['.ts', '.tsx', '.js'],
  '.mjs': ['.mts', '.mjs'],
  '.cjs': ['.cts', '.cjs'],
} satisfies Record<string, string[]>

const toUnknownRecord = (value: unknown): Record<string, unknown> | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return Object.fromEntries(Object.entries(value))
}

const isPublicExportPath = (key: string): boolean => key === '.' || key.startsWith('./')

const toProjectRelativePath = (projectRoot: string, absolutePath: string): string | undefined => {
  const relativePath = relative(projectRoot, absolutePath)
  if (relativePath.startsWith('..') || isAbsolute(relativePath)) return undefined
  return relativePath.startsWith('.') ? relativePath : `./${relativePath}`
}

const selectExportTarget = (
  value: unknown,
  activeConditions: readonly string[] = esmConditionNames,
): string | undefined => {
  if (typeof value === 'string') return value

  if (Array.isArray(value)) {
    for (const entry of value) {
      const target = selectExportTarget(entry, activeConditions)
      if (target) return target
    }
    return undefined
  }

  const record = toUnknownRecord(value)
  if (!record) return undefined

  for (const [key, entryValue] of Object.entries(record)) {
    if (activeConditions.includes(key) || key === 'default') {
      const target = selectExportTarget(entryValue, activeConditions)
      if (target) return target
    }
  }

  return undefined
}

/**
 * Select public package exports using ESM conditions.
 *
 * Supports:
 * - root string exports
 * - conditional root exports
 * - subpath maps with nested conditional branches
 */
export const getPublicExportTargets = (
  exportsField: unknown,
  activeConditions: readonly string[] = esmConditionNames,
): Record<string, string> => {
  if (typeof exportsField === 'string' || Array.isArray(exportsField)) {
    const target = selectExportTarget(exportsField, activeConditions)
    return target ? { '.': target } : {}
  }

  const record = toUnknownRecord(exportsField)
  if (!record) return {}

  const publicKeys = Object.keys(record).filter(isPublicExportPath)
  if (publicKeys.length === 0) {
    const target = selectExportTarget(record, activeConditions)
    return target ? { '.': target } : {}
  }

  return Object.fromEntries(
    publicKeys.flatMap((key) => {
      const target = selectExportTarget(record[key], activeConditions)
      return target ? [[key, target]] : []
    }),
  )
}

export type SourceResolver = ReturnType<typeof createSourceResolver>

export const createSourceResolver = (params: {
  projectRoot: string
  tsconfigPath: string
  buildToSourcePath: (path: string) => string
}) => {
  const resolver = new ResolverFactory({
    conditionNames: [...esmConditionNames],
    extensions: resolverExtensions,
    extensionAlias: resolverExtensionAlias,
    tsconfig: {
      configFile: params.tsconfigPath,
      references: 'auto',
    },
  })

  const resolutionCache = new Map<string, string | undefined>()

  const resolveSourcePath = (importerFilePath: string, specifier: string): string | undefined => {
    const cacheKey = `${importerFilePath}\u0000${specifier}`
    if (resolutionCache.has(cacheKey)) {
      return resolutionCache.get(cacheKey)
    }

    const result = resolver.resolveFileSync(importerFilePath, specifier)
    const resolvedPath = result.path

    if (!resolvedPath) {
      resolutionCache.set(cacheKey, undefined)
      return undefined
    }

    const projectRelativePath = toProjectRelativePath(params.projectRoot, resolvedPath)
    const sourcePath = projectRelativePath
      ? join(params.projectRoot, params.buildToSourcePath(projectRelativePath))
      : resolvedPath

    resolutionCache.set(cacheKey, sourcePath)
    return sourcePath
  }

  const resolveSourceFile = (
    project: Project,
    importerFilePath: string,
    specifier: string,
  ): SourceFile | undefined => {
    const resolvedPath = resolveSourcePath(importerFilePath, specifier)
    if (!resolvedPath) return undefined

    return project.getSourceFile(resolvedPath) ?? project.addSourceFileAtPathIfExists(resolvedPath)
  }

  return {
    resolveSourcePath,
    resolveSourceFile,
  }
}
