const rewriteBuildPathToSourcePath = (value: string): string =>
  value.replace(/^\.\/build\//, './src/').replace(/\.js$/u, '.ts')

const rewriteSourcePathToBuildPath = (value: string): string =>
  value.replace(/^\.\/src\//, './build/').replace(/\.ts$/u, '.js')

const rewriteJsonTreeStrings = (value: unknown, rewriter: (value: string) => string): unknown => {
  if (typeof value === 'string') return rewriter(value)

  if (Array.isArray(value)) {
    return value.map((item) => rewriteJsonTreeStrings(item, rewriter))
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [
        key,
        key === 'types' ? nested : rewriteJsonTreeStrings(nested, rewriter),
      ]),
    )
  }

  return value
}

const collectJsonTreeStrings = (value: unknown): readonly string[] => {
  if (typeof value === 'string') return [value]

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectJsonTreeStrings(item))
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, nested]) =>
      key === 'types' ? [] : collectJsonTreeStrings(nested),
    )
  }

  return []
}

/**
 * Rewrites runtime target strings from source-oriented dev paths to build paths.
 */
export const rewriteRuntimeTargetsToBuild = <T>(value: T): T =>
  rewriteJsonTreeStrings(value, rewriteSourcePathToBuildPath) as T

/**
 * Rewrites runtime target strings from build paths to source-oriented dev paths.
 */
export const rewriteRuntimeTargetsToSource = <T>(value: T): T =>
  rewriteJsonTreeStrings(value, rewriteBuildPathToSourcePath) as T

/**
 * Returns runtime target strings that still point at build output instead of source files.
 *
 * Ignores `types` declarations because those intentionally remain declaration-oriented.
 */
export const findBuildRuntimeTargets = (value: unknown): readonly string[] =>
  collectJsonTreeStrings(value).filter((target) => /^\.\/build\/.*\.js$/u.test(target))

/**
 * Reports whether runtime targets are already source-oriented for local development.
 */
export const isRuntimeTargetSourceOriented = (value: unknown): boolean =>
  findBuildRuntimeTargets(value).length === 0
