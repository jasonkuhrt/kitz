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
