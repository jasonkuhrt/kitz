import { Str } from '@kitz/core'
import type { Parsed } from './filter.js'
import type * as Level from './level.js'

/**
 * Type-level parser for log filter strings.
 * Mirrors the runtime parser logic for compile-time filter analysis.
 *
 * @example
 * ```ts
 * type F1 = Parse<"app">
 * // { negate: false, path: { value: ".app", descendants: false }, level: { value: "info", comp: "gte" } }
 *
 * type F2 = Parse<"app:*@warn+">
 * // { negate: false, path: { value: ".app", descendants: { includeParent: true } }, level: { value: "warn", comp: "gte" } }
 * ```
 */

// ============================================================================
// Helper Types
// ============================================================================

/**
 * Trim whitespace from string.
 */
type Trim<S extends string> = S extends ` ${infer Rest}`
  ? Trim<Rest>
  : S extends `${infer Rest} `
    ? Trim<Rest>
    : S

// ============================================================================
// Defaults
// ============================================================================

/**
 * Default level configuration when not specified in the pattern.
 */
type DefaultLevel = {
  value: 'info'
  comp: 'gte'
}

// ============================================================================
// Helper Types
// ============================================================================

/**
 * Extract negation prefix.
 */
type ExtractNegate<S extends string> = S extends `!${infer Rest}`
  ? { negate: true; rest: Rest }
  : { negate: false; rest: S }

/**
 * Level number string.
 */
type LevelNumString = '1' | '2' | '3' | '4' | '5' | '6'

/**
 * Level names.
 */
type LevelName = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'

/**
 * Map level numbers to names.
 */
type LevelNumToName<N extends LevelNumString> = N extends '1'
  ? 'trace'
  : N extends '2'
    ? 'debug'
    : N extends '3'
      ? 'info'
      : N extends '4'
        ? 'warn'
        : N extends '5'
          ? 'error'
          : N extends '6'
            ? 'fatal'
            : never

/**
 * Extract level specification from the end of a pattern.
 * Format: @(*|(<levelNum>|<levelName>)[+-])
 */
type ExtractLevel<S extends string> =
  // @* - wildcard level
  S extends `${infer Path}@*`
    ? {
        path: Path
        level: { value: '*'; comp: 'eq' }
      }
    : // @<level>+ - level or higher
      S extends `${infer Path}@${infer L extends LevelName | LevelNumString}+`
      ? {
          path: Path
          level: {
            value: L extends LevelNumString ? LevelNumToName<L> : L
            comp: 'gte'
          }
        }
      : // @<level>- - level or lower
        S extends `${infer Path}@${infer L extends LevelName | LevelNumString}-`
        ? {
            path: Path
            level: {
              value: L extends LevelNumString ? LevelNumToName<L> : L
              comp: 'lte'
            }
          }
        : // @<level> - exact level
          S extends `${infer Path}@${infer L extends LevelName | LevelNumString}`
          ? {
              path: Path
              level: {
                value: L extends LevelNumString ? LevelNumToName<L> : L
                comp: 'eq'
              }
            }
          : // No level specified - use default
            {
              path: S
              level: DefaultLevel
            }

/**
 * Parse path pattern with descendant wildcards.
 */
type ParsePath<S extends string> =
  // Root with descendants: *
  S extends '*'
    ? { value: '.'; descendants: { includeParent: true } }
    : // Root descendants only: :*
      S extends ':*'
      ? { value: '.'; descendants: { includeParent: false } }
      : // Path descendants only: <path>::* (check this BEFORE <path>:* to avoid greedy matching)
        S extends `${infer P}::*`
        ? {
            value: P extends `.${string}` ? P : `.${P}`
            descendants: { includeParent: false }
          }
        : // Path with descendants: <path>:*
          S extends `${infer P}:*`
          ? {
              value: P extends `.${string}` ? P : `.${P}`
              descendants: { includeParent: true }
            }
          : // Explicit root
            S extends '.'
            ? { value: '.'; descendants: false }
            : // Regular path
              {
                value: S extends `.${string}` ? S : S extends '' ? '.' : `.${S}`
                descendants: false
              }

// ============================================================================
// Main Parser
// ============================================================================

/**
 * Parse a single filter pattern at the type level.
 */
export type ParseOne<S extends string> =
  ExtractNegate<S> extends { negate: infer N; rest: infer R extends string }
    ? ExtractLevel<R> extends { path: infer P extends string; level: infer L }
      ? {
          originalInput: S
          negate: N
          path: ParsePath<P>
          level: L
        }
      : never
    : never

/**
 * Parse a comma-separated list of filter patterns.
 *
 * @example
 * ```ts
 * type F = Parse<"app,!nexus">
 * // [
 * //   { negate: false, path: { value: ".app", ... }, ... },
 * //   { negate: true, path: { value: ".nexus", ... }, ... }
 * // ]
 * ```
 */
export type Parse<S extends string> = string extends S
  ? Parsed[] // Non-literal string fallback
  : Str.Split<S, ','> extends infer Parts extends readonly string[]
    ? { [K in keyof Parts]: ParseOne<Trim<Parts[K]>> }
    : never
