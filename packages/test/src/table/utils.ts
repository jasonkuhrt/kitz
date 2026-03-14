/* eslint-disable eslint-plugin-jest/valid-describe-callback, eslint-plugin-vitest/no-conditional-tests -- Test framework implementation */
import { Err, Fn, Lang, Obj, Prom, Str } from '@kitz/core'
import { Equal, Schema as S } from 'effect'
import objectInspect from 'object-inspect'
import { describe as vitestDescribe, expect } from 'vitest'

type SnapshotSerializer = (value: any, context: any) => string
type FormatSnapshotWithInput = (
  input: any[],
  result: Prom.Envelope,
  runner?: Fn.AnyAny,
  serializer?: SnapshotSerializer,
  context?: any,
  snapshotConfig?: { arguments?: boolean },
) => string

// ============================================================================
// Assertion Utilities
// ============================================================================

/**
 * Custom assertion that uses Effect's Equal.equals for equivalence checking.
 * Falls back to Vitest's toEqual for better error messages when values are not equal.
 */
export const assertEffectEqual = (actual: any, expected: any) => {
  // First try Effect's Equal.equals for proper equivalence checking
  // This handles Effect data types that implement Equal trait
  const isEqual = Equal.equals(actual, expected)

  if (!isEqual) {
    // Use toEqual for better diff output when assertion fails
    expect(actual).toEqual(expected)
  }
  // If Equal.equals returns true, assertion passes silently
}

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Validate that user context doesn't contain reserved property names.
 * Reserved names: input, output, result, comment
 */
export const validateContextKeys = (context: object, caseName: string): void => {
  const reservedKeys = ['input', 'output', 'result', 'comment']
  const contextKeys = Object.keys(context)
  const conflicts = contextKeys.filter((key) => reservedKeys.includes(key))

  if (conflicts.length > 0) {
    throw new Error(
      `Test case "${caseName}" contains reserved context keys: ${conflicts.join(', ')}. ` +
        `Reserved keys are: ${reservedKeys.join(', ')}. ` +
        `Please rename these properties in your test context.`,
    )
  }
}

// ============================================================================
// Describe Block Utilities
// ============================================================================

/**
 * Creates nested describe blocks from a description containing ' > ' separator.
 *
 * @example
 * ```ts
 * createNestedDescribe('Arguments > Enums', runTests)
 * // Creates: describe('Arguments', () => describe('Enums', runTests))
 * ```
 */
export const createNestedDescribe = (description: string, callback: () => void): void => {
  const parts = description.split(' > ').map((part) => part.trim())

  if (parts.length === 1) {
    vitestDescribe(description, callback)
    return
  }

  // Create nested describe blocks from outer to inner
  const createNested = (index: number): void => {
    if (index === parts.length - 1) {
      vitestDescribe(parts[index]!, callback)
    } else {
      vitestDescribe(parts[index]!, () => createNested(index + 1))
    }
  }

  createNested(0)
}

// ============================================================================
// Matrix Utilities
// ============================================================================

/**
 * Generate all combinations (cartesian product) of matrix values.
 *
 * @example
 * ```ts
 * generateMatrixCombinations({ a: [1, 2], b: ['x', 'y'] })
 * // Returns: [
 * //   { a: 1, b: 'x' },
 * //   { a: 1, b: 'y' },
 * //   { a: 2, b: 'x' },
 * //   { a: 2, b: 'y' }
 * // ]
 * ```
 */
export const generateMatrixCombinations = (
  matrix: Record<string, readonly any[]>,
): Array<Record<string, any>> => {
  const keys = Object.keys(matrix)
  if (keys.length === 0) return [{}]

  const combinations: Array<Record<string, any>> = []

  const generate = (index: number, current: Record<string, any>) => {
    if (index === keys.length) {
      combinations.push({ ...current })
      return
    }

    const key = keys[index]!
    const values = matrix[key]!

    for (const value of values) {
      current[key] = value
      generate(index + 1, current)
    }
  }

  generate(0, {})
  return combinations
}

// ============================================================================
// Snapshot Utilities
// ============================================================================

/**
 * Default snapshot serializer with smart handling for different value types.
 *
 * Uses specialized formatting for specific types:
 * - **Strings**: Raw display without JSON quotes for readability
 * - **Functions**: `.toString()` representation
 * - **Errors**: {@link Err.inspect} with `maxFrames: 0` for portable snapshots (no stack traces)
 * - **Schema instances**: Encoded to their primitive representation
 *
 * All other values use `object-inspect` which provides:
 * - **Circular reference handling**: Shows `[Circular]` instead of throwing
 * - **Special type support**: Maps, Sets, Dates, RegExp, TypedArrays, etc.
 * - **Clean formatting**: Single quotes, 2-space indentation
 * - **Type-aware output**: Distinguishes null, undefined, symbols, BigInt, etc.
 *
 * @param value - The value to serialize
 * @param _context - Test context (unused by default serializer, available for custom serializers)
 * @param schemas - Optional array of Effect schemas to check and encode
 * @returns Formatted string representation
 */
export const defaultSnapshotSerializer = (
  value: any,
  _context: any,
  schemas: Array<S.Codec<any, any>> = [],
): string => {
  // Phase 1: Transform schema instances to encoded values
  const transformed =
    schemas.length > 0
      ? Obj.mapValuesDeep(value, (v) => {
          for (const schema of schemas) {
            if (S.is(schema)(v)) {
              return S.encodeSync(schema)(v)
            }
          }
          // Return undefined to continue recursing
        })
      : value

  // Phase 2: Format (existing logic)
  if (typeof transformed === 'string') return transformed
  if (typeof transformed === 'function') return transformed.toString()
  if (typeof transformed === 'undefined') return 'undefined'
  if (typeof transformed === 'symbol') return transformed.toString()
  if (typeof transformed === 'bigint') return transformed.toString() + 'n'
  if (transformed instanceof RegExp) return transformed.toString()
  if (Err.is(transformed))
    return Err.inspect(transformed, { maxFrames: 0, showHelp: false, color: false })
  return objectInspect(transformed, { indent: 2, depth: Infinity })
}

/**
 * Get a human-readable type label for a value.
 */
export const getTypeLabel = (value: any): string => {
  if (value === null) return `NULL`
  if (value === undefined) return `UNDEFINED`

  const type = typeof value
  if (type === `string`) return type.toUpperCase() // todo all like this
  if (type === `number`) return `NUMBER`
  if (type === `boolean`) return `BOOLEAN`
  if (type === `bigint`) return `BIGINT`
  if (type === `symbol`) return `SYMBOL`
  if (type === `function`) return `FUNCTION`

  // Check for built-in types
  if (Array.isArray(value)) return `ARRAY`
  if (value instanceof RegExp) return `REGEXP`
  if (value instanceof Date) return `DATE`
  if (value instanceof Map) return `MAP`
  if (value instanceof Set) return `SET`
  if (value instanceof Promise) return `PROMISE`
  if (value instanceof Error) return value.constructor.name.toUpperCase()

  return `OBJECT`
}

// ============================================================================
// Snapshot Box Building Helpers
// ============================================================================

type BoxPart =
  | { _tag: 'section'; label: string; body?: string }
  | { _tag: 'division'; body: string }

const buildBox = ({ width, parts }: { width: number; parts: BoxPart[] }) => {
  const b = Str.Builder()
  b('') // Leading newline

  let sectionCount = 0
  let previousPartTag: BoxPart['_tag'] | null = null

  parts.forEach((part) => {
    switch (part._tag) {
      case 'section': {
        sectionCount++
        const isFirstSection = sectionCount === 1

        // Add section divider with label
        if (isFirstSection) {
          b('╔' + '═'.repeat(width) + '╗' + part.label)
        } else {
          b('╠' + '═'.repeat(width) + '╣' + part.label)
        }

        // Add body if provided
        if (part.body !== undefined) {
          b(part.body)
        }

        previousPartTag = 'section'
        break
      }

      case 'division': {
        // Add separator line only between consecutive divisions
        if (previousPartTag === 'division') {
          b('.'.repeat(width + 2))
        }
        b(part.body)
        previousPartTag = 'division'
        break
      }

      default:
        return Lang.neverCase(part)
    }
  })

  // Closing border
  b('╚' + '═'.repeat(width) + '╝')

  return b.render()
}

/**
 * Format a snapshot with clear GIVEN/THEN sections showing arguments and return value or error.
 *
 * ## Modes
 *
 * - **Function mode** (has inputs): `GIVEN ARGUMENTS → THEN RETURNS/THROWS`
 * - **Runner mode** (no inputs): `RUNNER → OUTPUTS RETURN/THROW`
 *
 * ## Promise Handling
 *
 * The `result` envelope distinguishes between:
 * - **Resolved promises**: Labeled as `THEN RETURNS PROMISE RESOLVING TO {TYPE}`
 * - **Rejected promises**: Labeled as `THEN RETURNS PROMISE REJECTING TO {TYPE}`
 * - **Sync returns**: Labeled as `THEN RETURNS {TYPE}`
 * - **Sync throws**: Labeled as `THEN THROWS {TYPE}`
 *
 * @param input - Array of input arguments to display in GIVEN section
 * @param result - Execution result envelope from {@link Prom.maybeAsyncEnvelope}
 * @param runner - Optional runner function to display in RUNNER section
 * @param serializer - Custom serializer for values (defaults to {@link defaultSnapshotSerializer})
 * @param context - Test context passed to serializer
 * @returns Formatted snapshot string with box-drawing characters
 *
 * @example
 * ```ts
 * // Sync result
 * const envelope = Prom.maybeAsyncEnvelope(() => add(1, 2))
 * formatSnapshotWithInput([1, 2], envelope)
 * // ╔══════════════════════════════════════════════════╗ GIVEN ARGUMENTS
 * // 1
 * // ────────────────────────────────────────────────────
 * // 2
 * // ╠══════════════════════════════════════════════════╣ THEN RETURNS NUMBER
 * // 3
 * // ╚══════════════════════════════════════════════════╝
 * ```
 *
 * @category Snapshot Utilities
 */
export const formatSnapshotWithInput: FormatSnapshotWithInput = (
  input: any[],
  result: Prom.Envelope,
  runner?: Fn.AnyAny,
  serializer: SnapshotSerializer = defaultSnapshotSerializer,
  context: any = {},
  snapshotConfig: { arguments?: boolean } = { arguments: true },
): string => {
  // Fixed width for all boxes
  const width = 50

  const value = result.value
  const valueSerialized = serializer(value, context)

  const hasInput = input.length > 0

  if (hasInput) {
    const formattedInputs = input.map((i) => serializer(i, context))

    // Build parts array conditionally based on config
    const parts: BoxPart[] = []

    // Include arguments section if enabled
    if (snapshotConfig.arguments !== false) {
      parts.push({ _tag: 'section', label: ' GIVEN ARGUMENTS' })
      parts.push(...formattedInputs.map((body) => ({ _tag: 'division' as const, body })))
    }

    // Always include output section
    parts.push({
      _tag: 'section',
      label: buildOutputLabel(result, 'function', value),
      body: valueSerialized,
    })

    return buildBox({ width, parts })
  }

  // Runner mode: Show runner function and output
  if (runner) {
    const analyzed = Fn.analyzeFunction(runner)

    return buildBox({
      width,
      parts: [
        { _tag: 'section', label: ' RUNNER', body: analyzed.body },
        {
          _tag: 'section',
          label: buildOutputLabel(result, 'runner', value),
          body: valueSerialized,
        },
      ],
    })
  }

  // Fallback: no runner function available
  return buildBox({
    width,
    parts: [
      { _tag: 'section', label: buildOutputLabel(result, 'runner', value), body: valueSerialized },
    ],
  })
}

const buildOutputLabel = (
  result: Prom.Envelope,
  mode: 'function' | 'runner',
  valueToUse: any,
): string => {
  const isFail = result.fail
  const isAsync = result.async
  const typeLabel = getTypeLabel(valueToUse)

  const caseKey = `${mode}-${isFail}-${isAsync}` as const

  switch (caseKey) {
    case 'function-true-true':
      return ` THEN RETURNS PROMISE REJECTING TO ${typeLabel}`
    case 'function-true-false':
      return ` THEN THROWS ${typeLabel}`
    case 'function-false-true':
      return ` THEN RETURNS PROMISE RESOLVING TO ${typeLabel}`
    case 'function-false-false':
      return ` THEN RETURNS ${typeLabel}`
    case 'runner-true-true':
      return ` OUTPUTS THROW PROMISE REJECTING TO ${typeLabel}`
    case 'runner-true-false':
      return ` OUTPUTS THROW ${typeLabel}`
    case 'runner-false-true':
      return ` OUTPUTS RETURN PROMISE RESOLVING TO ${typeLabel}`
    case 'runner-false-false':
      return ` OUTPUTS RETURN ${typeLabel}`
    default:
      return Lang.neverCase(caseKey)
  }
}
