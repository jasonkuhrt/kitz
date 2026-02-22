/**
 * Gitignore file parsing, manipulation, and serialization.
 *
 * Provides a structured representation of `.gitignore` files with
 * round-trip support (parse → modify → stringify).
 *
 * @example
 * ```ts
 * import { Git } from '@kitz/git'
 *
 * // File resource (preferred for Effect workflows)
 * yield* Git.Gitignore.resource.update(projectDir, (g) =>
 *   g.hasPattern('dist/') ? g : g.addPattern('dist/', { section: 'Build' })
 * )
 *
 * // Convenience API
 * const gitignore = Git.Gitignore.fromString(content)
 * const output = Git.Gitignore.toString(gitignore)
 *
 * // Schema codec (for custom Effect pipelines)
 * const gitignore = Schema.decodeSync(Git.Gitignore.Schema)(content)
 * const output = Schema.encodeSync(Git.Gitignore.Schema)(gitignore)
 * ```
 *
 * @module
 */

import { Str } from '@kitz/core'
import { Resource } from '@kitz/resource'
import { Schema as S } from 'effect'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Immutably modify array element at index */
const modifyAt = <T>(arr: readonly T[], index: number, fn: (item: T) => T): T[] => {
  const result = [...arr]
  result[index] = fn(arr[index]!)
  return result
}

// ─── Internal Schemas ─────────────────────────────────────────────────────────

/**
 * A validated, normalized gitignore pattern.
 *
 * Decoding normalizes input:
 * - Trims whitespace (per gitignore spec, trailing spaces are ignored)
 * - Strips pointless `./` prefix
 *
 * Validates:
 * - Non-empty (after normalization)
 * - No null bytes (would corrupt the file)
 *
 * @see https://git-scm.com/docs/gitignore
 *
 * @example
 * ```ts
 * import { Schema } from 'effect'
 * import { Git } from '@kitz/git'
 *
 * Schema.decodeSync(Git.Gitignore.Pattern)('  ./node_modules/  ')  // 'node_modules/'
 * Schema.decodeSync(Git.Gitignore.Pattern)('')  // throws (empty after trim)
 * ```
 */
const Pattern = S.transform(
  S.String,
  S.String.pipe(
    S.nonEmptyString(),
    S.pattern(/^[^\x00]*$/, { message: () => 'Pattern cannot contain null bytes' }),
    S.brand('GitignorePattern'),
  ),
  {
    strict: true,
    decode: (s) => {
      let normalized = s.trim()
      while (normalized.startsWith('./')) {
        normalized = normalized.slice(2)
      }
      return normalized
    },
    encode: (p) => p,
  },
)

type Pattern = S.Schema.Type<typeof Pattern>

/** Decode a string to a normalized Pattern (convenience). */
const decodePattern = S.decodeSync(Pattern)

/**
 * A single gitignore entry (pattern line).
 */
class Entry extends S.Class<Entry>('GitignoreEntry')({
  /** The pattern (normalized) */
  pattern: Pattern,
  /** Whether negated with ! prefix */
  negated: S.Boolean,
}) {}

/**
 * A section of entries, optionally preceded by a comment header.
 *
 * @remarks
 * Sections preserve the structure of gitignore files that use
 * comments to organize patterns (e.g., `# Dependencies`).
 */
class Section extends S.Class<Section>('GitignoreSection')({
  /** Comment lines (including #), empty array for no header */
  comments: S.Array(S.String),
  /** Entries in this section */
  entries: S.Array(Entry),
}) {}

// ─── Internal Parse/Stringify ─────────────────────────────────────────────────

/**
 * Parse gitignore content into structured representation.
 */
const parse = (content: string): Gitignore => {
  const lines = Str.Text.lines(content)
  const sections: Section[] = []

  let currentComments: string[] = []
  let currentEntries: Entry[] = []

  const flushSection = () => {
    if (currentComments.length > 0 || currentEntries.length > 0) {
      sections.push(Section.make({
        comments: currentComments,
        entries: currentEntries,
      }))
      currentComments = []
      currentEntries = []
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()

    if (line === '') {
      if (currentEntries.length > 0) {
        flushSection()
      }
      continue
    }

    if (line.startsWith('#')) {
      if (currentEntries.length > 0) {
        flushSection()
      }
      currentComments.push(line)
      continue
    }

    const negated = line.startsWith('!')
    const rawPattern = negated ? line.slice(1) : line
    const pattern = decodePattern(rawPattern)

    if (pattern !== '') {
      currentEntries.push(Entry.make({ pattern, negated }))
    }
  }

  flushSection()

  return Gitignore.make({ sections })
}

/**
 * Serialize gitignore to string format.
 */
const toStringGitignore = (gitignore: Gitignore): string => {
  const parts: string[] = []

  for (const section of gitignore.sections) {
    for (const comment of section.comments) {
      parts.push(comment)
    }

    for (const entry of section.entries) {
      const prefix = entry.negated ? '!' : ''
      parts.push(`${prefix}${entry.pattern}`)
    }

    parts.push('')
  }

  if (parts.length > 0 && parts[parts.length - 1] === '') {
    parts.pop()
  }

  return parts.length > 0 ? parts.join('\n') + '\n' : ''
}

// ─── Main Class ───────────────────────────────────────────────────────────────

/**
 * A parsed gitignore file.
 *
 * Uses Class-is-Module pattern - all API is exposed as static members.
 *
 * @example
 * ```ts
 * import { Git } from '@kitz/git'
 *
 * const g = Git.Gitignore.fromString(content)
 * g.hasPattern('node_modules/')
 * const updated = g.addPattern('dist/')
 * Git.Gitignore.toString(updated)
 * ```
 */
export class Gitignore extends S.Class<Gitignore>('Gitignore')({
  /** Sections (patterns grouped by preceding comments) */
  sections: S.Array(Section),
}) {
  // ─── Internal Types (exposed for advanced use) ─────────────────────────────

  /** A single gitignore entry (pattern line). */
  static Entry = Entry

  /** A section of entries with optional comment header. */
  static Section = Section

  /** A validated, normalized gitignore pattern schema. */
  static Pattern = Pattern

  // ─── Constants ─────────────────────────────────────────────────────────────

  /** Empty gitignore (for new files). */
  static empty: Gitignore = Gitignore.make({ sections: [] })

  // ─── Schema Codec ──────────────────────────────────────────────────────────

  /**
   * Schema for parsing gitignore content from string.
   *
   * @example
   * ```ts
   * import { Schema } from 'effect'
   * import { Git } from '@kitz/git'
   *
   * const content = '# Build\nnode_modules/\ndist/'
   * const gitignore = Schema.decodeSync(Git.Gitignore.Schema)(content)
   * const output = Schema.encodeSync(Git.Gitignore.Schema)(gitignore)
   * ```
   */
  static Schema: S.Schema<Gitignore, string> = S.transform(
    S.String,
    Gitignore,
    {
      strict: true,
      decode: (content) => parse(content) as any,
      encode: (gitignore) => toStringGitignore(gitignore as any),
    },
  ) as any

  // ─── Resource ──────────────────────────────────────────────────────────────

  /**
   * File resource for reading/writing `.gitignore` files.
   *
   * @example
   * ```ts
   * import { Git } from '@kitz/git'
   *
   * // Read existing gitignore (or empty if not found)
   * const gitignore = yield* Git.Gitignore.resource.readOrEmpty(projectDir)
   *
   * // Update gitignore atomically
   * yield* Git.Gitignore.resource.update(projectDir, (g) =>
   *   g.hasPattern('dist/') ? g : g.addPattern('dist/', { section: 'Build' })
   * )
   * ```
   */
  static resource = Resource.create('.gitignore', Gitignore.Schema, Gitignore.empty)

  // ─── Convenience Wrappers ──────────────────────────────────────────────────

  /**
   * Parse gitignore content from string.
   *
   * @example
   * ```ts
   * import { Git } from '@kitz/git'
   * const gitignore = Git.Gitignore.fromString(content)
   * ```
   */
  static fromString = S.decodeSync(Gitignore.Schema)

  /**
   * Serialize gitignore to string.
   *
   * @example
   * ```ts
   * import { Git } from '@kitz/git'
   * const output = Git.Gitignore.toString(gitignore)
   * ```
   */
  static override toString = S.encodeSync(Gitignore.Schema)

  // ─── Static Operations ─────────────────────────────────────────────────────

  /**
   * Get all patterns as a flat array (for matching purposes).
   * Includes negation prefix (!) where applicable.
   */
  static patterns = (gitignore: Gitignore): readonly string[] =>
    gitignore.sections.flatMap((s) => s.entries.map((e) => (e.negated ? '!' : '') + e.pattern))

  /**
   * Check if a pattern exists (normalized comparison).
   *
   * @param gitignore - The gitignore to check
   * @param pattern - Pattern to check (will be normalized)
   * @param options - Match options
   * @param options.matchNegated - If true, also matches negated version
   */
  static hasPattern = (
    gitignore: Gitignore,
    pattern: string,
    options?: { matchNegated?: boolean },
  ): boolean => {
    const normalized = decodePattern(pattern)
    const matchNegated = options?.matchNegated ?? false

    for (const section of gitignore.sections) {
      for (const entry of section.entries) {
        if (entry.pattern === normalized) {
          if (!entry.negated || matchNegated) {
            return true
          }
        }
      }
    }

    return false
  }

  /**
   * Add a pattern to the gitignore.
   *
   * @param gitignore - The gitignore to modify
   * @param pattern - Pattern to add (will be normalized)
   * @param options - Add options
   * @param options.section - Section header to add to (creates if missing)
   * @param options.negated - Whether to negate the pattern
   * @returns New gitignore with pattern added (or unchanged if duplicate)
   */
  static addPattern = (
    gitignore: Gitignore,
    pattern: string,
    options?: { section?: string; negated?: boolean },
  ): Gitignore => {
    const normalized = decodePattern(pattern)
    const negated = options?.negated ?? false
    const sectionHeader = options?.section

    if (Gitignore.hasPattern(gitignore, normalized, { matchNegated: true })) {
      return gitignore
    }

    const newEntry = Entry.make({ pattern: normalized, negated })

    if (sectionHeader !== undefined) {
      const sectionIndex = gitignore.sections.findIndex((s) => s.comments.some((c) => c.includes(sectionHeader)))

      if (sectionIndex >= 0) {
        return Gitignore.make({
          sections: modifyAt(gitignore.sections, sectionIndex, (section) =>
            Section.make({
              ...section,
              entries: [...section.entries, newEntry],
            })),
        })
      } else {
        const newSection = Section.make({
          comments: [`# ${sectionHeader}`],
          entries: [newEntry],
        })
        return Gitignore.make({
          sections: [...gitignore.sections, newSection],
        })
      }
    }

    if (gitignore.sections.length === 0) {
      return Gitignore.make({
        sections: [Section.make({ comments: [], entries: [newEntry] })],
      })
    }

    const lastIndex = gitignore.sections.length - 1
    return Gitignore.make({
      sections: modifyAt(gitignore.sections, lastIndex, (section) =>
        Section.make({
          ...section,
          entries: [...section.entries, newEntry],
        })),
    })
  }

  /**
   * Remove a pattern from the gitignore.
   *
   * @param gitignore - The gitignore to modify
   * @param pattern - Pattern to remove (will be normalized)
   * @returns New gitignore with pattern removed
   */
  static removePattern = (gitignore: Gitignore, pattern: string): Gitignore => {
    const normalized = decodePattern(pattern)

    return Gitignore.make({
      sections: gitignore.sections
        .map((section) =>
          Section.make({
            ...section,
            entries: section.entries.filter((e) => e.pattern !== normalized),
          })
        )
        .filter((s) => s.entries.length > 0 || s.comments.length > 0),
    })
  }

  // ─── Instance Methods (delegate to statics) ────────────────────────────────

  /** All patterns as a flat array. */
  get patterns(): readonly string[] {
    return Gitignore.patterns(this)
  }

  /** Check if a pattern exists. */
  hasPattern(pattern: string, options?: { matchNegated?: boolean }): boolean {
    return Gitignore.hasPattern(this, pattern, options)
  }

  /** Add a pattern (immutable). */
  addPattern(pattern: string, options?: { section?: string; negated?: boolean }): Gitignore {
    return Gitignore.addPattern(this, pattern, options)
  }

  /** Remove a pattern (immutable). */
  removePattern(pattern: string): Gitignore {
    return Gitignore.removePattern(this, pattern)
  }

  /** String coercion sugar for logging and template literals. */
  override toString(): string {
    return Gitignore.toString(this)
  }
}
