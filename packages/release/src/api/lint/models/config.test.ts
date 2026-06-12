import { Exit, Schema } from 'effect'
import { describe, expect, test } from 'bun:test'
import { Config, resolveConfig, RuleConfig, RuleConfigInput } from './config.js'
import { RuleDefaults, RuleId } from './rule-defaults.js'

describe('resolveConfig', () => {
  test('returns system defaults when no config', () => {
    const resolved = resolveConfig({})
    expect(resolved.defaults.enabled).toBe('auto')
    expect(resolved.defaults.severity).toBe('error')
  })

  test('applies global defaults', () => {
    const resolved = resolveConfig({
      defaults: RuleDefaults.make({ enabled: false }),
    })
    expect(resolved.defaults.enabled).toBe(false)
    expect(resolved.defaults.severity).toBe('error') // system default
  })

  test('resolves severity shorthand, inheriting enabled from defaults', () => {
    const ruleId = RuleId.make('pr.type.match-known')
    const resolved = resolveConfig({
      rules: { [ruleId]: 'warn' },
    })
    const rule = resolved.rules[ruleId]!
    expect(rule.overrides.severity).toBe('warn')
    expect(rule.overrides.enabled).toBe('auto')
    expect(rule.options).toEqual({})
  })

  test('resolves tuple shorthand with options', () => {
    const ruleId = RuleId.make('pr.scope.require')
    const resolved = resolveConfig({
      rules: { [ruleId]: ['error', { min: 1 }] },
    })
    const rule = resolved.rules[ruleId]!
    expect(rule.overrides.severity).toBe('error')
    expect(rule.options).toEqual({ min: 1 })
  })

  test('resolves full RuleConfig objects, filling unset overrides from defaults', () => {
    const ruleId = RuleId.make('env.git-remote')
    const resolved = resolveConfig({
      defaults: RuleDefaults.make({ severity: 'warn' }),
      rules: {
        [ruleId]: RuleConfig.make({
          overrides: RuleDefaults.make({ enabled: true }),
          options: { remote: 'upstream' },
        }),
      },
    })
    const rule = resolved.rules[ruleId]!
    expect(rule.overrides.enabled).toBe(true)
    expect(rule.overrides.severity).toBe('warn') // inherited from global defaults
    expect(rule.options).toEqual({ remote: 'upstream' })
  })

  test('full RuleConfig overrides win over global defaults', () => {
    const ruleId = RuleId.make('env.git-remote')
    const resolved = resolveConfig({
      defaults: RuleDefaults.make({ enabled: false, severity: 'warn' }),
      rules: {
        [ruleId]: RuleConfig.make({
          overrides: RuleDefaults.make({ enabled: 'auto', severity: 'error' }),
          options: {},
        }),
      },
    })
    const rule = resolved.rules[ruleId]!
    expect(rule.overrides.enabled).toBe('auto')
    expect(rule.overrides.severity).toBe('error')
  })

  test('every grammar form resolves to the same severity for both severities', () => {
    const ruleId = RuleId.make('env.git-clean')
    for (const severity of ['error', 'warn'] as const) {
      const inputs = [
        severity,
        [severity, {}] as const,
        RuleConfig.make({
          overrides: RuleDefaults.make({ severity }),
          options: {},
        }),
      ]
      for (const input of inputs) {
        const resolved = resolveConfig({ rules: { [ruleId]: input } })
        expect(resolved.rules[ruleId]!.overrides.severity).toBe(severity)
      }
    }
  })
})

describe('RuleConfigInput grammar', () => {
  const decode = Schema.decodeUnknownExit(RuleConfigInput)

  test('accepts bare severity shorthand', () => {
    expect(Exit.isSuccess(decode('warn'))).toBe(true)
    expect(Exit.isSuccess(decode('error'))).toBe(true)
  })

  test('accepts tuple shorthand', () => {
    expect(Exit.isSuccess(decode(['error', { remote: 'upstream' }]))).toBe(true)
  })

  test('accepts full RuleConfig form', () => {
    const exit = decode({
      _tag: 'RuleConfig',
      overrides: { _tag: 'RuleDefaults', enabled: true },
      options: {},
    })
    expect(Exit.isSuccess(exit)).toBe(true)
  })

  // Regression: a number rule config used to pass Config decoding (rules was
  // Record<string, unknown>) and then crash resolveConfig with a raw TypeError.
  // It must fail decoding with a typed schema failure instead.
  test('rejects a number with a typed schema failure', () => {
    expect(Exit.isFailure(decode(42))).toBe(true)
  })

  test('rejects a malformed object with a typed schema failure', () => {
    expect(Exit.isFailure(decode({ bogus: true }))).toBe(true)
  })

  test('rejects an unknown severity string with a typed schema failure', () => {
    expect(Exit.isFailure(decode('loud'))).toBe(true)
  })

  test('rejects a malformed tuple with a typed schema failure', () => {
    expect(Exit.isFailure(decode(['error']))).toBe(true)
  })

  // Regression at the Config level: bad rule values fail Config decoding instead
  // of passing through to resolveConfig and crashing there.
  test('Config decoding rejects invalid rule values', () => {
    const decodeConfig = Schema.decodeUnknownExit(Config)
    expect(Exit.isFailure(decodeConfig({ _tag: 'Config', rules: { 'env.git-clean': 42 } }))).toBe(
      true,
    )
    expect(
      Exit.isSuccess(decodeConfig({ _tag: 'Config', rules: { 'env.git-clean': 'warn' } })),
    ).toBe(true)
  })
})
