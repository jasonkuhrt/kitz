/** The `repository` field shape of a package.json manifest. */
export type RepositoryField = string | { readonly url?: string | undefined } | undefined

const githubShorthandRe = /^github:([^/]+)\/([^/]+?)(?:\.git)?$/
const githubUrlRe = /github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/

/**
 * Extract the GitHub `owner/repo` slug from a package.json `repository` field.
 *
 * Supports the `github:owner/repo` shorthand and URLs pointing at
 * `github.com` (https, git+https, ssh), with or without a `.git` suffix.
 *
 * Returns `null` when the field is absent, has no usable URL, or does not
 * point at GitHub.
 */
export const extractRepositoryGitHubSlug = (repository: RepositoryField): string | null => {
  const value =
    typeof repository === 'string'
      ? repository
      : typeof repository === 'object' && repository !== null && 'url' in repository
        ? repository.url
        : undefined

  if (typeof value !== 'string') return null

  const githubShorthand = value.match(githubShorthandRe)
  if (githubShorthand) {
    return `${githubShorthand[1]}/${githubShorthand[2]}`
  }

  const githubUrl = value.match(githubUrlRe)
  if (githubUrl) {
    return `${githubUrl[1]}/${githubUrl[2]}`
  }

  return null
}
