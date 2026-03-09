import { Schema } from 'effect'
import { Multi } from './commit-multi.js'
import { Single } from './commit-single.js'
import type { Type } from './type.js'

export { Multi } from './commit-multi.js'
export { Single } from './commit-single.js'

/**
 * A conventional commit—either single (standard CC) or multi (extended for monorepos).
 */
export const Commit = Schema.Union(Single, Multi)

/**
 * Type alias for the Commit union.
 */
export type Commit = typeof Commit.Type

/**
 * Normalized view of one type/scope/breaking facet in a commit.
 */
export interface Facet {
  readonly type: Type
  readonly scope: string | null
  readonly breaking: boolean
}

/**
 * Expand a commit into normalized type/scope/breaking facets.
 */
export const facets = (commit: Commit): readonly Facet[] => {
  if (Single.is(commit)) {
    if (commit.scopes.length === 0) {
      return [{ type: commit.type, scope: null, breaking: commit.breaking }]
    }

    return commit.scopes.map((scope) => ({
      type: commit.type,
      scope,
      breaking: commit.breaking,
    }))
  }

  return commit.targets.map((target) => ({
    type: target.type,
    scope: target.scope,
    breaking: target.breaking,
  }))
}

/**
 * Extract all scopes from a commit.
 */
export const scopes = (commit: Commit): readonly string[] =>
  facets(commit).flatMap((facet) => (facet.scope ? [facet.scope] : []))

/**
 * Extract unique commit types in first-seen order.
 */
export const types = (commit: Commit): readonly Type[] => {
  const values = new Set<string>()
  const result: Type[] = []

  for (const facet of facets(commit)) {
    if (values.has(facet.type.value)) continue
    values.add(facet.type.value)
    result.push(facet.type)
  }

  return result
}

/**
 * Render a canonical conventional-commit header from a parsed commit.
 */
export const renderHeader = (commit: Commit): string => {
  if (Single.is(commit)) {
    const scopesPart = commit.scopes.length > 0 ? `(${commit.scopes.join(', ')})` : ''
    const breakingPart = commit.breaking ? '!' : ''
    return `${commit.type.value}${scopesPart}${breakingPart}`
  }

  const groups = new Map<
    string,
    {
      readonly type: Type
      readonly breaking: boolean
      readonly scopes: string[]
    }
  >()

  for (const target of commit.targets) {
    const key = `${target.type.value}:${target.breaking ? 'breaking' : 'stable'}`
    const group = groups.get(key)
    if (group) {
      group.scopes.push(target.scope)
      continue
    }

    groups.set(key, {
      type: target.type,
      breaking: target.breaking,
      scopes: [target.scope],
    })
  }

  return [...groups.values()]
    .map((group) => {
      const scopesPart = group.scopes.length > 0 ? `(${group.scopes.join(', ')})` : ''
      const breakingPart = group.breaking ? '!' : ''
      return `${group.type.value}${scopesPart}${breakingPart}`
    })
    .join(', ')
}
