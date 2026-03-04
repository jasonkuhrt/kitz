import { Lang } from '#lang'

/**
 * @category Introspection
 */
export type Parameter = { type: 'name'; value: string } | { type: 'destructured'; names: string[] }

/**
 * Analyze a function to extract its parameter information and body.
 *
 * Parses a function's string representation to extract:
 * - Parameter names (both regular and destructured parameters)
 * - Function body (both statement and expression forms, trimmed and dedented)
 *
 * The returned body is already cleaned: leading/trailing whitespace removed and
 * common indentation stripped away for clean display in its isolated form.
 *
 * @category Introspection
 * @param fn - The function to analyze
 * @returns An object containing the function's cleaned body and parameters
 * @throws {Error} If the function cannot be parsed or has invalid structure
 *
 * @example
 * ```ts
 * const fn = (a, { b, c }) => a + b + c
 * const info = analyzeFunction(fn)
 * // info.parameters: [{ type: 'name', value: 'a' }, { type: 'destructured', names: ['b', 'c'] }]
 * // info.body: "a + b + c" (already trimmed and dedented)
 * ```
 */
export const analyzeFunction = (fn: (...args: [...any[]]) => unknown) => {
  const groups = fn.toString().match(functionPattern)?.groups
  if (!groups) throw new Error(`Could not extract groups from function.`)

  const bodyRaw = groups[`bodyStatement`] ?? groups[`bodyExpression`]
  if (bodyRaw === undefined) throw new Error(`Could not extract body from function.`)

  // Clean the body: strip common indentation first, then trim
  // Inlined stripIndent logic to avoid circular dependency with str module
  const bodyLines = bodyRaw.split('\n')
  const indents = bodyLines
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const match = line.match(/^(\s*)/)
      return match?.[1]?.length ?? 0
    })

  const minIndent = indents.length > 0 ? Math.min(...indents) : 0
  const dedented = bodyLines.map((line) => line.slice(minIndent)).join('\n')
  const body = dedented.trim()

  const parameters: Parameter[] = []

  if (groups[`parameters`]) {
    const results = [...groups[`parameters`].matchAll(functionParametersPattern)]
    const resultParameters = results.map(result => {
      const type = result.groups?.[`destructured`] ? `destructured` : result.groups?.[`name`] ? `name` : null

      switch (type) {
        case `destructured`:
          const valueRaw = result.groups![`destructured`]!
          const names = [...valueRaw.matchAll(destructuredPattern)].map(result => {
            const name = result.groups![`name`]
            if (name === undefined) throw new Error(`Could not extract name from destructured parameter.`)
            return name
          })
          return {
            type,
            names,
          } as const
        case `name`:
          return {
            type,
            value: result.groups![`name`]!,
          } as const
        case null:
          throw new Error(`Could not determine type of parameter.`)
        default:
          throw Lang.neverCase(type)
      }
    })

    parameters.push(...resultParameters)
  }

  return {
    body,
    parameters,
  }
}

/**
 * Check if a function is unary (has exactly one parameter).
 *
 * @category Introspection
 * @param fn - The function to check
 * @returns True if the function has exactly one parameter, false otherwise
 *
 * @example
 * ```ts
 * const unary = (x: number) => x * 2
 * const binary = (a: number, b: number) => a + b
 * const nullary = () => 42
 *
 * isUnary(unary)   // true
 * isUnary(binary)  // false
 * isUnary(nullary) // false
 * ```
 */
export const isUnary = (fn: (...args: [...any[]]) => unknown): boolean => {
  const { parameters } = analyzeFunction(fn)
  return parameters.length === 1
}

/**
 * @see https://regex101.com/r/U0JtfS/1
 */
const functionPattern =
  /^(?:(?<async>async)\s+)?(?:function\s+)?(?:(?<name>[A-z_0-9]+)\s*)?\((?<parameters>[^)]*)\)\s*(?:=>\s*(?<bodyExpression>[^\s{].*)|(?:=>\s*)?{(?<bodyStatement>.*)})$/s

/**
 * @see https://regex101.com/r/tE2dV5/2
 */
const functionParametersPattern = /(?<destructured>\{[^}]+\})|(?<name>[A-z_][A-z_0-9]*)/gs

/**
 * https://regex101.com/r/WHwazx/1
 */
const destructuredPattern = /(?<name>[A-z_][A-z_0-9]*)(?::[^},]+)?/gs
