import { beforeEach } from 'bun:test'

export const createState = <X, Value = string>(params?: {
  value?: (values: X[]) => Value
}): { set: (value: X) => X[]; values: X[]; value: Value } => {
  let values: X[] = []

  beforeEach(() => {
    values = []
  })

  return {
    get values(): X[] {
      return values
    },
    get value(): Value {
      return params?.value?.(values) ?? (values.join(``) as Value)
    },
    set: (newValue: X): X[] => {
      values.push(newValue)
      return values
    },
  }
}

const createEnvironmentManager = () => {
  let changes: Record<string, string | undefined> = {}

  function set(environment: Record<string, string>): void
  function set(key: string, value: string): void
  function set(...args: [key: string, value: string] | [Record<string, string>]): void {
    if (args.length === 1) {
      const [environment] = args
      Object.entries(environment).forEach(([key, value]) => {
        changes[key] = value
        process.env[key] = value
      })
    } else {
      const [key, value] = args
      changes[key] = value
      process.env[key] = value
    }
  }

  const reset = () => {
    // Clear vars this manager set during the test
    Object.keys(changes).forEach((key) => {
      delete process.env[key]
    })
    changes = {}
    // Also clear any CLI_* envs leaking from the parent shell — bun:test runs
    // in-process and inherits the full ambient environment, unlike vitest's
    // forked workers. The oak parser reads CLI_PARAM_* / CLI_PARAMETER_* /
    // CLI_SETTINGS_* envs by design, so any stray value pollutes assertions.
    Object.keys(process.env).forEach((key) => {
      const upper = key.toUpperCase()
      if (
        upper.startsWith('CLI_PARAM_') ||
        upper.startsWith('CLI_PARAMETER_') ||
        upper.startsWith('CLI_SETTINGS_')
      ) {
        delete process.env[key]
      }
    })
  }

  return {
    set,
    reset,
  }
}

export const environmentManager = createEnvironmentManager()

beforeEach(environmentManager.reset)
