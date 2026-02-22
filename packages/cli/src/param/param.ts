import { Str, Ts } from '@kitz/core'
import { ParseResult, Schema as S } from 'effect'

/**
 * Error for CLI parameter parsing failures.
 */
export interface ErrorParamParse<$message extends string> extends
  Ts.Err.StaticError<
    ['cli', 'param', 'parse'],
    { message: $message }
  >
{}

// ============================================================================
// Type-Level Utilities (Internal)
// ============================================================================

/**
 * Get the length of a string type.
 *
 * Uses recursive character counting since string literals don't have numeric length at type-level.
 */
type Length<$S extends string, $Acc extends any[] = []> = $S extends `${infer _First}${infer Rest}`
  ? Length<Rest, [...$Acc, any]>
  : $Acc['length']

/**
 * Convert a string type to camelCase.
 *
 * Handles:
 * - kebab-case → camelCase
 * - snake_case → camelCase
 * - Already camelCase → unchanged
 *
 * @example
 * ```typescript
 * type A = CamelCase<'foo-bar'>  // 'fooBar'
 * type B = CamelCase<'foo_bar'>  // 'fooBar'
 * type C = CamelCase<'fooBar'>   // 'fooBar'
 * ```
 */
type CamelCase<$S extends string> = $S extends `${infer First}-${infer Rest}` ? `${First}${Capitalize<CamelCase<Rest>>}`
  : $S extends `${infer First}_${infer Rest}` ? `${First}${Capitalize<CamelCase<Rest>>}`
  : $S

/**
 * Update a nested object property by path.
 *
 * @example
 * ```typescript
 * type Obj = { a: { b: number } }
 * type Updated = Update<Obj, 'a.b', string>  // { a: { b: string } }
 * ```
 */
type Update<$Obj, $Path extends string, $Value> = $Path extends `${infer Key}.${infer Rest}`
  ? $Obj extends Record<any, any>
    ? Key extends keyof $Obj ? Ts.Simplify.Top<Omit<$Obj, Key> & { [k in Key]: Update<$Obj[k], Rest, $Value> }>
    : $Obj
  : $Obj
  : $Obj extends Record<any, any>
    ? $Path extends keyof $Obj ? Ts.Simplify.Top<Omit<$Obj, $Path> & { [k in $Path]: $Value }>
    : $Obj
  : $Obj

/**
 * Append an element to a tuple type.
 *
 * @example
 * ```typescript
 * type Arr = ['a', 'b']
 * type Extended = Append<Arr, 'c'>  // ['a', 'b', 'c']
 * ```
 */
type Append<$Tuple extends readonly any[], $Element> = [...$Tuple, $Element]

// ============================================================================
// Runtime Analyzer
// ============================================================================

/**
 * Runtime analyzer for CLI parameter expressions.
 *
 * Analyzes a parameter expression string into a structured analysis object with:
 * - Primary short and long names
 * - Additional aliases
 * - Canonical name (long takes precedence)
 *
 * All names are normalized to camelCase.
 *
 * @param expression - The parameter expression to analyze (e.g., "-v --verbose -x --extra")
 * @returns Analyzed Param object with canonical name, short/long, and aliases
 *
 * @example
 * ```typescript
 * analyze('-v')
 * // { expression: '-v', canonical: 'v', short: 'v', long: null, aliases: { short: [], long: [] } }
 *
 * analyze('--verbose')
 * // { expression: '--verbose', canonical: 'verbose', short: null, long: 'verbose', aliases: { short: [], long: [] } }
 *
 * analyze('-v --verbose')
 * // { expression: '-v --verbose', canonical: 'verbose', short: 'v', long: 'verbose', aliases: { short: [], long: [] } }
 * ```
 */
export function analyze<const $input extends string>($input: $input) {
  const names = $input
    .trim()
    .split(` `)
    .map((_) => _.trim())
    .map(stripeDashPrefix)
    .map(Str.Case.camel)
    .filter((_) => _.length > 0)

  const longs = names.filter((name): name is string => name.length > 1)
  const shorts = names.filter((name): name is string => name.length === 1)
  const short = (shorts.shift() ?? null)!
  const long = (longs.shift() ?? null)!
  const canonical = (long ?? short)!

  return {
    expression: $input,
    canonical,
    short,
    long,
    aliases: {
      short: shorts,
      long: longs,
    },
  } as any
}

/**
 * Remove leading dashes from a parameter name.
 */
const stripeDashPrefix = (name: string): string => {
  if (name.startsWith(`--`)) {
    return name.slice(2)
  }
  if (name.startsWith(`-`)) {
    return name.slice(1)
  }
  return name
}

// ============================================================================
// CLI Parameter Name Class
// ============================================================================

/**
 * CLI parameter name with validation.
 *
 * Represents a parsed and validated CLI parameter name with:
 * - Canonical name (the primary name used for the flag)
 * - Optional short name (single character)
 * - Optional long name (multiple characters, camelCased)
 * - Aliases (additional short and long names)
 * - Original expression
 *
 * @example
 * ```typescript
 * // Create from string
 * const flag1 = Param.fromString('-v --verbose')
 * // { canonical: 'verbose', short: 'v', long: 'verbose', aliases: { short: [], long: [] }, expression: '-v --verbose' }
 *
 * const flag2 = Param.fromString('--foo-bar')
 * // { canonical: 'fooBar', short: null, long: 'fooBar', aliases: { short: [], long: [] }, expression: '--foo-bar' }
 *
 * // Type-level parsing with validation
 * type Valid = Param.Analyze<'-v --verbose'>
 * // { canonical: 'verbose', short: 'v', long: 'verbose', ... }
 *
 * type Invalid = Param.Analyze<'--v'>
 * // Error: "A long flag must be two (2) or more characters..."
 * ```
 */
export class Param extends S.Class<Param>('Param')({
  /**
   * The canonical (primary) name for the flag.
   * Long names take precedence over short names.
   */
  canonical: S.String,

  /**
   * Single-character short name (e.g., 'v' from '-v').
   */
  short: S.NullOr(S.String),

  /**
   * Multi-character long name in camelCase (e.g., 'verbose' from '--verbose', 'fooBar' from '--foo-bar').
   */
  long: S.NullOr(S.String),

  /**
   * Additional alias names.
   */
  aliases: S.Struct({
    short: S.Array(S.String),
    long: S.Array(S.String),
  }),

  /**
   * Original parameter expression string.
   */
  expression: S.String,
}) {
  /**
   * Schema for parsing from/encoding to string representation.
   * Use this when you need to accept string parameter expressions.
   *
   * @example
   * ```typescript
   * const ConfigSchema = S.Struct({
   *   flagName: Param.String
   * })
   * ```
   */
  static String = S.transformOrFail(
    S.String,
    Param,
    {
      strict: true,
      decode: (input, options, ast) => {
        // Validate input BEFORE analyzer (to catch prefix-based errors)
        const trimmed = input.trim()

        // Validate: Empty check
        if (!trimmed) {
          return ParseResult.fail(
            new ParseResult.Type(ast, input, 'You must specify at least one name for your flag.'),
          )
        }

        // Validate: Check each flag in the expression
        const flags = trimmed.split(/\s+/)
        for (const flag of flags) {
          // Short flag with too many characters: -vv
          if (flag.startsWith('-') && !flag.startsWith('--')) {
            const name = flag.slice(1)
            if (name.length !== 1) {
              return ParseResult.fail(
                new ParseResult.Type(ast, input, `Short flag must be exactly one character: '${flag}'`),
              )
            }
          }
          // Long flag with too few characters: --v
          if (flag.startsWith('--')) {
            const name = flag.slice(2)
            if (name.length < 2) {
              return ParseResult.fail(
                new ParseResult.Type(ast, input, `Long flag must be two or more characters: '${flag}'`),
              )
            }
          }
        }

        // Use runtime analyzer to parse the parameter expression
        const analysis = analyze(input)

        // Validate: No duplicates (check after camelCase normalization)
        const allNames = [
          analysis.short,
          analysis.long,
          ...analysis.aliases.short,
          ...analysis.aliases.long,
        ].filter((name): name is string => name !== null)
        const seen = new Set<string>()
        for (const name of allNames) {
          if (seen.has(name)) {
            return ParseResult.fail(
              new ParseResult.Type(ast, input, `Duplicate alias: "${name}"`),
            )
          }
          seen.add(name)
        }

        // Create Param instance from analysis
        return ParseResult.succeed(
          new Param({
            canonical: analysis.canonical,
            short: analysis.short,
            long: analysis.long,
            aliases: analysis.aliases,
            expression: analysis.expression,
          }),
        )
      },
      encode: (decoded) => {
        // Encode back to original expression string
        return ParseResult.succeed(decoded.expression)
      },
    },
  )

  /**
   * Create a typed Param from a literal string with compile-time validation.
   *
   * This function requires a literal string at compile time to provide
   * type-safe parsing. The return type is automatically validated and structured
   * based on the input string.
   *
   * For runtime strings (non-literals), use `decodeSync` instead.
   *
   * @param input - A literal string parameter expression
   * @returns Param instance with inferred type structure
   *
   * @example
   * ```typescript
   * const flag1 = Param.fromString('-v --verbose')
   * // Type: { canonical: 'verbose', short: 'v', long: 'verbose', ... }
   *
   * const flag2 = Param.fromString('--foo-bar')
   * // Type: { canonical: 'fooBar', long: 'fooBar', ... } (kebab → camel)
   *
   * // Type error: long flag too short
   * const flag3 = Param.fromString('--v')
   * // Error: "A long flag must be two (2) or more characters..."
   *
   * // This will cause a type error:
   * const expr: string = getExpression()
   * const flag = Param.fromString(expr)  // Error: string not assignable
   * // Use this instead: Param.decodeSync(expr)
   * ```
   */
  static fromString = <const $input extends string>(
    $input: Param.Analyze<$input> extends string ? ErrorParamParse<Param.Analyze<$input>>
      : $input,
  ) => {
    return S.decodeSync(Param.String)($input as any) as any
  }

  /**
   * Create a typed Param from a literal string.
   *
   * Canonical literal-parser naming across the monorepo.
   */
  static fromLiteral = <const $input extends string>(
    $input: Param.Analyze<$input> extends string ? ErrorParamParse<Param.Analyze<$input>>
      : $input,
  ) => {
    return Param.fromString($input as any) as any
  }

  /**
   * Runtime analyzer function.
   * @see {@link analyze}
   */
  static analyze = analyze
}

// ============================================================================
// Type-Level API
// ============================================================================

/**
 * Type-level utilities for Param.
 */
export namespace Param {
  // ==========================================================================
  // Public Name Types
  // ==========================================================================

  /**
   * Parsed parameter name structure.
   */
  export type Name = {
    expression: string
    canonical: string | null
    aliases: {
      short: [...string[]]
      long: [...string[]]
    }
    long: string | null
    short: string | null
  }

  /**
   * Empty parameter name (initial parsing state).
   */
  export type NameEmpty = {
    expression: string
    canonical: null
    aliases: {
      short: []
      long: []
    }
    long: null
    short: null
  }

  /**
   * Limits/constraints for parsing (reserved and already-used names).
   */
  export interface SomeLimits {
    reservedNames: string | undefined
    usedNames: string | undefined
  }

  // ==========================================================================
  // Parser Error Types
  // ==========================================================================

  /**
   * Parser error types.
   */
  export namespace Errors {
    export interface TrailingPipe extends
      Ts.Err.StaticError<
        ['cli', 'param', 'trailing-pipe'],
        {
          message: 'Trailing pipe in parameter expression'
          tip: 'Pipes are for adding aliases. Add more names after your pipe or remove it'
        }
      >
    {}

    export interface Empty extends
      Ts.Err.StaticError<
        ['cli', 'param', 'empty'],
        { message: 'You must specify at least one name for your parameter' }
      >
    {}

    export interface Unknown extends
      Ts.Err.StaticError<
        ['cli', 'param', 'unknown'],
        { message: 'Cannot parse your parameter expression' }
      >
    {}
  }

  // ==========================================================================
  // Validation Checks
  // ==========================================================================

  /**
   * Validation checks for parameter names.
   */
  export namespace Checks {
    /**
     * Error message types for parameter name validation failures.
     */
    export namespace Messages {
      export interface LongTooShort<$Variant extends string> extends
        Ts.Err.StaticError<
          readonly ['cli', 'param', 'check', 'long-too-short'],
          {
            message: 'Long flag must be two or more characters'
            variant: $Variant
            received: `--${$Variant}`
          }
        >
      {}

      export interface AliasDuplicate<$Variant extends string> extends
        Ts.Err.StaticError<
          readonly ['cli', 'param', 'check', 'alias-duplicate'],
          {
            message: 'Duplicate alias'
            variant: $Variant
          }
        >
      {}

      export interface ShortTooLong<$Variant extends string> extends
        Ts.Err.StaticError<
          readonly ['cli', 'param', 'check', 'short-too-long'],
          {
            message: 'Short flag must be exactly one character'
            variant: $Variant
            received: `-${$Variant}`
          }
        >
      {}

      export interface AlreadyTaken<$Variant extends string> extends
        Ts.Err.StaticError<
          readonly ['cli', 'param', 'check', 'already-taken'],
          {
            message: 'Name already used for another parameter'
            variant: $Variant
          }
        >
      {}

      export interface Reserved<$Variant extends string> extends
        Ts.Err.StaticError<
          readonly ['cli', 'param', 'check', 'reserved'],
          {
            message: 'Name is reserved'
            variant: $Variant
          }
        >
      {}
    }

    /**
     * Validation check types for parameter names.
     * Each check has a predicate and an error message.
     */
    export namespace Kinds {
      export type LongTooShort<$Variant extends string> = {
        predicate: Length<$Variant> extends 1 ? true : false
        message: Messages.LongTooShort<$Variant>
      }

      export type ShortTooLong<$Variant extends string> = {
        predicate: Length<$Variant> extends 1 ? false : true
        message: Messages.ShortTooLong<$Variant>
      }

      export type AliasDuplicate<$Name extends Name, $Variant extends string> = {
        predicate: CamelCase<$Variant> extends $Name['long'] | $Name['short'] ? true : false
        message: Messages.AliasDuplicate<$Variant>
      }

      export type AlreadyTaken<$Limits extends SomeLimits, $Variant extends string> = {
        predicate: $Limits['usedNames'] extends undefined ? false
          : CamelCase<$Variant> extends CamelCase<Exclude<$Limits['usedNames'], undefined>> ? true
          : false
        message: Messages.AlreadyTaken<$Variant>
      }

      export type Reserved<$Limits extends SomeLimits, $Variant extends string> = {
        predicate: $Limits['reservedNames'] extends undefined ? false
          : CamelCase<$Variant> extends CamelCase<Exclude<$Limits['reservedNames'], undefined>> ? true
          : false
        message: Messages.Reserved<$Variant>
      }
    }

    /**
     * A validation check result with predicate and error message.
     */
    export interface Result {
      predicate: boolean
      message: Ts.Err.StaticError
    }

    /**
     * Non-empty array of validation failures.
     */
    export type SomeFailures = [Result, ...Result[]]

    /**
     * Base validation checks that apply to all flag variants (short and long).
     */
    export type BaseChecks<
      $Variant extends string,
      $limits extends SomeLimits,
      $Param extends Name,
    > = FilterFailures<
      [
        Kinds.AliasDuplicate<$Param, $Variant>,
        Kinds.AlreadyTaken<$limits, $Variant>,
        Kinds.Reserved<$limits, $Variant>,
      ]
    >

    /**
     * Validation checks specific to long flags (--flag).
     */
    export type LongChecks<
      $Variant extends string,
      $limits extends SomeLimits,
      $Param extends Name,
    > = FilterFailures<[...BaseChecks<$Variant, $limits, $Param>, Kinds.LongTooShort<$Variant>]>

    /**
     * Validation checks specific to short flags (-f).
     */
    export type ShortChecks<
      $Variant extends string,
      $limits extends SomeLimits,
      $Param extends Name,
    > = FilterFailures<[...BaseChecks<$Variant, $limits, $Param>, Kinds.ShortTooLong<$Variant>]>

    /**
     * Return the first validation failure message.
     * Since messages are now structured Ts.Err.StaticError objects, we return the first one.
     */
    export type ReportFailures<$Results extends [...Result[]]> = $Results extends
      [infer Head extends Result, ...infer Tail extends Result[]] ? Head['predicate'] extends true ? Head['message']
      : ReportFailures<Tail>
      : never

    /**
     * Filter a list of validation checks down to only the failures (predicate = true).
     */
    type FilterFailures<$Results extends [...Result[]], $Accumulator extends Result[] = []> = $Results extends
      [infer Head extends Result, ...infer Tail extends Result[]]
      ? Head['predicate'] extends true ? FilterFailures<Tail, [...$Accumulator, Head]>
      : FilterFailures<Tail, $Accumulator>
      : $Accumulator
  }

  // ==========================================================================
  // Type-Level Analyzer (Recursive Parser)
  // ==========================================================================

  export interface SomeLimitsNone {
    reservedNames: undefined
    usedNames: undefined
  }

  /**
   * Add a name variant to the Name being built during parsing.
   */
  type Add<
    $Kind extends 'short' | 'long',
    $Name extends Name,
    $Variant extends string,
  > = $Kind extends 'short' ? $Name['short'] extends null ? AddShort<$Name, $Variant>
    : AddAliasShort<$Name, $Variant>
    : $Kind extends 'long' ? $Name['long'] extends null ? AddLong<$Name, $Variant>
      : AddAliasLong<$Name, $Variant>
    : never

  /**
   * Add a long alias to an existing Name (long already set).
   */
  type AddAliasLong<$Name extends Name, $Variant extends string> = Update<
    $Name,
    'aliases.long',
    Append<$Name['aliases']['long'], CamelCase<$Variant>>
  >

  /**
   * Add a short alias to an existing Name (short already set).
   */
  type AddAliasShort<$Name extends Name, $Variant extends string> = Update<
    $Name,
    'aliases.short',
    Append<$Name['aliases']['short'], $Variant>
  >

  /**
   * Set the primary long name (first long encountered).
   */
  type AddLong<$Name extends Name, $Variant extends string> = Update<$Name, 'long', CamelCase<$Variant>>

  /**
   * Set the primary short name (first short encountered).
   */
  type AddShort<$Name extends Name, $Variant extends string> = Update<$Name, 'short', $Variant>

  /**
   * Set the canonical name (long takes precedence over short).
   */
  type addCanonical<$Name extends Name> = Update<
    $Name,
    'canonical',
    $Name['long'] extends string ? $Name['long']
      : $Name['short'] extends string ? $Name['short']
      : never // A valid flag always has either a long or short name
  >

  /**
   * Analyze a CLI parameter expression into a Name type.
   *
   * This is a recursive type-level parser that handles:
   * - Short flags: `-v`
   * - Long flags: `--verbose`
   * - Multiple flags: `-v --verbose`
   * - Aliases: `-v --verbose -x --extra`
   * - Whitespace: trimmed automatically
   * - No prefix: `v verbose` (infers short/long by length)
   *
   * @example
   * ```typescript
   * type A = Analyze<'-v'>                      // { short: 'v', long: null, ... }
   * type B = Analyze<'--verbose'>               // { short: null, long: 'verbose', ... }
   * type C = Analyze<'-v --verbose'>            // { short: 'v', long: 'verbose', canonical: 'verbose', ... }
   * type D = Analyze<'-v --verbose -x'>         // { short: 'v', long: 'verbose', aliases: { short: ['x'], long: [] }, ... }
   * type E = Analyze<'--foo-bar'>               // { long: 'fooBar', ... } (kebab → camel)
   * type F = Analyze<'v version'>               // { short: 'v', long: 'version', ... } (no prefix)
   * type G = Analyze<'--v'>                     // Error: long flag must be 2+ chars
   * type H = Analyze<'-vv'>                     // Error: short flag must be 1 char
   * type I = Analyze<''>                        // Error: must specify at least one name
   * ```
   */
  export type Analyze<
    $E extends string,
    $limits extends SomeLimits = SomeLimitsNone,
    $names extends Name = NameEmpty,
  > = _Analyze<$E, $limits, $names>

  export type _Analyze<$E extends string, $Limits extends SomeLimits, $Name extends Name> =
    // Done!
    $E extends `` ? NameEmpty extends $Name ? Errors.Empty : addCanonical<$Name>
      // Trim leading and trailing whitespace
      : $E extends ` ${infer tail}` ? _Analyze<tail, $Limits, $Name>
      : $E extends `${infer initial} ` ? _Analyze<initial, $Limits, $Name>
      // Capture a long flag & continue
      : $E extends `--${infer v} ${infer tail}`
        ? Checks.LongChecks<v, $Limits, $Name> extends Checks.SomeFailures
          ? Checks.ReportFailures<Checks.LongChecks<v, $Limits, $Name>>
        : _Analyze<tail, $Limits, Add<'long', $Name, v>>
      // Capture a long name & Done!
      : $E extends `--${infer v}`
        ? Checks.LongChecks<v, $Limits, $Name> extends Checks.SomeFailures
          ? Checks.ReportFailures<Checks.LongChecks<v, $Limits, $Name>>
        : _Analyze<'', $Limits, Add<'long', $Name, v>>
      // Capture a short flag & continue
      : $E extends `-${infer v} ${infer tail}`
        ? Checks.ShortChecks<v, $Limits, $Name> extends Checks.SomeFailures
          ? Checks.ReportFailures<Checks.ShortChecks<v, $Limits, $Name>>
        : _Analyze<tail, $Limits, Add<'short', $Name, v>>
      // Capture a short name & Done!
      : $E extends `-${infer v}`
        ? Checks.ShortChecks<v, $Limits, $Name> extends Checks.SomeFailures
          ? Checks.ReportFailures<Checks.ShortChecks<v, $Limits, $Name>>
        : _Analyze<'', $Limits, Add<'short', $Name, v>>
      // Capture a long flag & continue (no prefix, inferred by length)
      : $E extends `${infer v} ${infer tail}`
        ? Checks.BaseChecks<v, $Limits, $Name> extends Checks.SomeFailures
          ? Checks.ReportFailures<Checks.BaseChecks<v, $Limits, $Name>>
        : _Analyze<tail, $Limits, Add<Length<v> extends 1 ? 'short' : 'long', $Name, v>>
      // Capture final name (no prefix, inferred by length)
      : $E extends `${infer v}`
        ? Checks.BaseChecks<v, $Limits, $Name> extends Checks.SomeFailures
          ? Checks.ReportFailures<Checks.BaseChecks<v, $Limits, $Name>>
        : _Analyze<'', $Limits, Add<Length<v> extends 1 ? 'short' : 'long', $Name, v>>
      : Errors.Unknown

  // ==========================================================================
  // Result Extraction Utilities
  // ==========================================================================

  /**
   * Check if an {@link Analyze} result is a parse error.
   *
   * Returns `true` if the result is a Ts.Err.StaticError, `false` if it's a parsed name.
   *
   * @example
   * ```typescript
   * type Valid = IsParseError<Analyze<'-v --verbose'>>  // false
   * type Invalid = IsParseError<Analyze<'--v'>>         // true
   * ```
   */
  export type IsParseError<$result> = Ts.Err.Is<$result>

  /**
   * Extract the canonical name from a successful parse, or the error object from a failed parse.
   *
   * @example
   * ```typescript
   * type Success = GetCanonicalNameOrError<Analyze<'-v --verbose'>>  // 'verbose'
   * type Error = GetCanonicalNameOrError<Analyze<'--v'>>             // Ts.Err.StaticError<...>
   * ```
   */
  export type GetCanonicalNameOrError<$result> = Ts.Err.Is<$result> extends true ? $result
    : $result extends Name ? $result['canonical']
    : never

  /**
   * Extract all possible parameter names as a union type from a successful parse.
   *
   * Returns `never` if the parse failed.
   *
   * Includes:
   * - Primary long name (if present)
   * - Primary short name (if present)
   * - All long aliases
   * - All short aliases
   *
   * @example
   * ```typescript
   * type Names = GetNames<Analyze<'-v --verbose -x --extra'>>
   * // 'v' | 'verbose' | 'x' | 'extra'
   *
   * type Error = GetNames<Analyze<'--v'>>
   * // never
   * ```
   */
  export type GetNames<$result> = $result extends Param ?
      | ($result['long'] extends string ? $result['long'] : never)
      | ($result['short'] extends string ? $result['short'] : never)
      | $result['aliases']['long'][number]
      | $result['aliases']['short'][number]
    : never
}
