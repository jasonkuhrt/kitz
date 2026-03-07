import objectInspect from 'object-inspect'

export const getNodeEnv = (): string | undefined => process.env[`NODE_ENV`]

export const getLogPretty = (): string | undefined => process.env[`LOG_PRETTY`]

export const getLogLevel = (): string | undefined => process.env[`LOG_LEVEL`]

export const getLogFilter = (): string | undefined => process.env[`LOG_FILTER`]

export const getCurrentTimeMillis = (): number => new globalThis.Date().getTime()

/**
 * Run a given parser over an environment variable. If parsing fails, throw a
 * contextual error message.
 */
export const parseFromEnvironment = <$T>(
  key: string,
  parser: {
    info: { valid: string; typeName: string }
    run: (raw: string) => null | $T
  },
): $T => {
  const envVarValue = process.env[key]! // assumes env presence handled before
  const result = parser.run(envVarValue)

  if (result === null) {
    throw new Error(
      `Could not parse environment variable ${key} into ${parser.info.typeName}. The environment variable was: ${objectInspect(
        envVarValue,
      )}. A valid environment variable must be like: ${parser.info.valid}`,
    )
  }

  return result
}
