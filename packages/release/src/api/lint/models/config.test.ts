import { describe, expect, test } from 'vitest'
import { resolveConfig } from './config.js'
import { RuleDefaults, RuleId } from './rule-defaults.js'
import * as Severity from './severity.js'

describe('resolveConfig', () => {
  test('returns system defaults when no config', () => {
    const resolved = resolveConfig({})
    expect(resolved.defaults.enabled).toBe('auto')
    expect(resolved.defaults.severity._tag).toBe('SeverityError')
  })

  test('applies global defaults', () => {
    const resolved = resolveConfig({
      defaults: RuleDefaults.make({ enabled: false }),
    })
    expect(resolved.defaults.enabled).toBe(false)
    expect(resolved.defaults.severity._tag).toBe('SeverityError') // system default
  })

  test('normalizes severity shorthand', () => {
    const ruleId = RuleId.make('pr.type.match-known')
    const resolved = resolveConfig({
      rules: { [ruleId]: Severity.Warn.make() },
    })
    const rule = resolved.rules[ruleId]!
    expect(rule.overrides.severity._tag).toBe('SeverityWarn')
  })

  test('normalizes tuple shorthand', () => {
    const ruleId = RuleId.make('pr.scope.require')
    const resolved = resolveConfig({
      rules: { [ruleId]: [Severity.Error.make(), { min: 1 }] },
    })
    const rule = resolved.rules[ruleId]!
    expect(rule.overrides.severity._tag).toBe('SeverityError')
    expect(rule.options).toEqual({ min: 1 })
  })
})
