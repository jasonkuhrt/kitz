import { Schema } from 'effect'
import { describe, expect, test } from 'bun:test'
import { RuleDefaults, RuleId } from './rule-defaults.js'
import { Rule } from './rule.js'

describe('Rule', () => {
  test('make minimal rule', () => {
    const rule = Rule.make({
      id: RuleId.make('env.git-clean'),
      description: 'Working directory must be clean',
      preconditions: [],
    })
    expect(rule._tag).toBe('Rule')
    expect(Rule.is(rule)).toBe(true)
    expect(rule.id).toBe<string>('env.git-clean')
    expect(rule.preconditions).toHaveLength(0)
  })

  test('make with preconditions', () => {
    const rule = Rule.make({
      id: RuleId.make('pr.type.match-known'),
      description: 'PR type must be a known conventional commit type',
      preconditions: ['hasOpenPR'],
    })
    expect(rule.preconditions).toHaveLength(1)
    expect(rule.preconditions[0]).toBe('hasOpenPR')
  })

  test('make with defaults', () => {
    const rule = Rule.make({
      id: RuleId.make('plan.tags-unique'),
      description: 'Planned tags must not already exist',
      preconditions: ['hasReleasePlan'],
      defaults: RuleDefaults.make({ enabled: true, severity: 'warn' }),
    })
    expect(rule.defaults).toBeDefined()
    expect(rule.defaults!.enabled).toBe(true)
    expect(rule.defaults!.severity).toBe('warn')
  })

  test('schema roundtrip', () => {
    const rule = Rule.make({
      id: RuleId.make('env.npm-authenticated'),
      description: 'npm must be authenticated',
      preconditions: ['hasReleasePlan'],
      defaults: RuleDefaults.make({ enabled: 'auto' }),
    })
    const encoded = Schema.encodeSync(Rule)(rule)
    const decoded = Schema.decodeSync(Rule)(encoded)
    expect(decoded.id).toBe<string>('env.npm-authenticated')
    expect(decoded.preconditions).toHaveLength(1)
    expect(decoded.defaults!.enabled).toBe('auto')
  })
})
