import { Err } from '@kitz/core'
import { Effect, Option, Schema as S } from 'effect'
import { Multi } from '../commit-multi.js'
import { Single } from '../commit-single.js'
import { Target } from '../target.js'
import { parse as parseType, Type } from '../type.js'

const baseTags = ['kit', 'conventional-commits'] as const

/**
 * Error parsing a conventional commit title.
 */
export const ParseTitleError = Err.TaggedContextualError(
  'ParseTitleError',
  baseTags,
  {
    context: S.Struct({
      reason: S.String,
      input: S.String,
    }),
    message: (ctx) => `${ctx.reason}: "${ctx.input}"`,
  },
)

export type ParseTitleError = InstanceType<typeof ParseTitleError>

/**
 * Parsed title result—either CommitSingle or CommitMulti (without body/footers yet).
 */
export type ParsedTitle = Single | Multi

// Regex for a single type-scope group: type(scope!, scope2)?!?
const TYPE_SCOPE_PATTERN = /^([a-z]+)(?:\(([^)]+)\))?(!)?$/

/**
 * Parse a conventional commit title line.
 *
 * CommitSingle when:
 * - Single type with zero or more scopes
 * - All scopes get same type and breaking
 *
 * CommitMulti when:
 * - Multiple comma-separated type(scope) groups
 * - OR same type but different breaking per scope
 */
export const parse = (
  title: string,
): Effect.Effect<ParsedTitle, ParseTitleError> =>
  Effect.gen(function*() {
    const trimmed = title.trim()

    // Split on `: ` to get header and message
    const colonIndex = trimmed.indexOf(':')
    if (colonIndex === -1) {
      return yield* Effect.fail(
        new ParseTitleError({ context: { reason: 'Missing colon separator', input: title } }),
      )
    }

    const header = trimmed.slice(0, colonIndex).trim()
    const message = trimmed.slice(colonIndex + 1).trim()

    if (!message) {
      return yield* Effect.fail(
        new ParseTitleError({ context: { reason: 'Empty message', input: title } }),
      )
    }

    // Check for global breaking indicator (! before :)
    const globalBreaking = header.endsWith('!')
    const headerWithoutGlobalBreaking = globalBreaking ? header.slice(0, -1) : header

    // Split by `, ` to detect multiple type-scope groups
    // But be careful: "feat(core, cli)" has comma inside parens, "feat(core), fix(cli)" has comma outside
    const groups = splitTypeScopeGroups(headerWithoutGlobalBreaking)

    if (groups.length === 1) {
      // Potentially CommitSingle
      const firstGroup = groups[0]
      if (!firstGroup) {
        return yield* Effect.fail(
          new ParseTitleError({ context: { reason: 'Invalid type-scope format', input: title } }),
        )
      }
      const parsed = parseTypeScopeGroup(firstGroup)
      if (!parsed) {
        return yield* Effect.fail(
          new ParseTitleError({ context: { reason: 'Invalid type-scope format', input: title } }),
        )
      }

      const { type, scopes, perScopeBreaking } = parsed
      const breaking = globalBreaking || perScopeBreaking.some(Boolean)

      // If we have per-scope breaking markers on individual scopes, it's still CommitSingle
      // because they all share the same type
      return Single.make({
        type,
        scopes,
        breaking,
        message,
        body: Option.none(),
        footers: [],
      })
    }

    // Multiple groups = CommitMulti
    const targets: Target[] = []
    for (const group of groups) {
      const parsed = parseTypeScopeGroup(group)
      if (!parsed) {
        return yield* Effect.fail(
          new ParseTitleError({ context: { reason: `Invalid type-scope group: ${group}`, input: title } }),
        )
      }

      const { type, scopes, perScopeBreaking } = parsed

      // Each scope in the group becomes a Target
      if (scopes.length === 0) {
        return yield* Effect.fail(
          new ParseTitleError({
            context: { reason: 'CommitMulti commits require scopes', input: title },
          }),
        )
      }

      for (let i = 0; i < scopes.length; i++) {
        const scope = scopes[i]
        if (!scope) continue
        targets.push(
          Target.make({
            type,
            scope,
            breaking: globalBreaking || perScopeBreaking[i] || false,
          }),
        )
      }
    }

    if (targets.length === 0) {
      return yield* Effect.fail(
        new ParseTitleError({ context: { reason: 'No targets found', input: title } }),
      )
    }

    return Multi.make({
      targets: targets as [Target, ...Target[]],
      message,
      summary: Option.none(),
      sections: {},
    })
  })

interface ParsedGroup {
  type: Type
  scopes: string[]
  perScopeBreaking: boolean[]
}

/**
 * Split header into type-scope groups, respecting parentheses.
 * "feat(core), fix(cli)" → ["feat(core)", "fix(cli)"]
 * "feat(core, cli)" → ["feat(core, cli)"]
 */
const splitTypeScopeGroups = (header: string): string[] => {
  const groups: string[] = []
  let current = ''
  let depth = 0

  for (const char of header) {
    if (char === '(') {
      depth++
      current += char
    } else if (char === ')') {
      depth--
      current += char
    } else if (char === ',' && depth === 0) {
      const trimmed = current.trim()
      if (trimmed) groups.push(trimmed)
      current = ''
    } else {
      current += char
    }
  }

  const trimmed = current.trim()
  if (trimmed) groups.push(trimmed)

  return groups
}

const parseTypeScopeGroup = (group: string): ParsedGroup | null => {
  const match = group.match(TYPE_SCOPE_PATTERN)
  if (!match) return null

  const [, typeString, scopesPart, groupBreaking] = match
  if (!typeString) return null

  const type = parseType(typeString)

  if (!scopesPart) {
    // No scopes: "feat" or "feat!"
    return {
      type,
      scopes: [],
      perScopeBreaking: [],
    }
  }

  // Parse scopes, checking for per-scope ! markers
  const scopes: string[] = []
  const perScopeBreaking: boolean[] = []

  for (const scope of scopesPart.split(/,\s*/)) {
    const scopeTrimmed = scope.trim()
    if (scopeTrimmed.endsWith('!')) {
      scopes.push(scopeTrimmed.slice(0, -1))
      perScopeBreaking.push(true)
    } else {
      scopes.push(scopeTrimmed)
      perScopeBreaking.push(groupBreaking === '!')
    }
  }

  return { type, scopes, perScopeBreaking }
}
