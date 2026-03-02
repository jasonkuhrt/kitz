/**
 * Options for plan operations.
 */
export interface Options {
  /** Skip npm publish */
  readonly dryRun?: boolean
  /** Only include specific packages */
  readonly packages?: readonly string[]
  /** Exclude specific packages */
  readonly exclude?: readonly string[]
}

/**
 * Options for PR release planning.
 */
export interface PrOptions extends Options {
  /**
   * PR number. If not provided, will attempt to detect from environment variables:
   * - GITHUB_PR_NUMBER (GitHub Actions)
   * - PR_NUMBER (generic CI)
   * - CI_PULL_REQUEST (CircleCI - extracts number from URL)
   */
  readonly prNumber?: number
}

/**
 * Test whether a package moniker passes include/exclude filters.
 *
 * Returns `true` when the package should be **kept** in the release plan.
 * The evaluation order mirrors the planner loop convention:
 * 1. If the moniker appears in `exclude`, reject.
 * 2. If `packages` is provided and the moniker is absent, reject.
 * 3. Otherwise, accept.
 */
export const passesFilter = (moniker: string, options?: Options): boolean => {
  if (options?.exclude?.includes(moniker)) return false
  if (options?.packages && !options.packages.includes(moniker)) return false
  return true
}
