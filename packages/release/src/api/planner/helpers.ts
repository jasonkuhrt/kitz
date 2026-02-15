/**
 * Detect PR number from environment variables.
 */
export const detectPrNumber = (vars: Record<string, string | undefined>): number | null => {
  // GitHub Actions
  if (vars['GITHUB_PR_NUMBER']) {
    const num = parseInt(vars['GITHUB_PR_NUMBER'], 10)
    if (!isNaN(num)) return num
  }

  // Generic CI
  if (vars['PR_NUMBER']) {
    const num = parseInt(vars['PR_NUMBER'], 10)
    if (!isNaN(num)) return num
  }

  // CircleCI (URL format: https://github.com/org/repo/pull/123)
  if (vars['CI_PULL_REQUEST']) {
    const match = vars['CI_PULL_REQUEST'].match(/\/pull\/(\d+)/)
    if (match) {
      const num = parseInt(match[1]!, 10)
      if (!isNaN(num)) return num
    }
  }

  return null
}
