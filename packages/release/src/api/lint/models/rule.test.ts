import { Schema } from 'effect'
import { describe, expect, test } from 'vitest'
import { HasOpenPR, HasReleasePlan } from './precondition.js'
import { RuleDefaults, RuleId } from './rule-defaults.js'
import { Rule } from './rule.js'
import * as Severity from './severity.js'

describe('Rule', () => {
  test('make minimal rule', () => {
    const rule = Rule.make({
      id: RuleId.makeUnsafe('env.git-clean'),
      description: 'Working directory must be clean',
      preconditions: [],
    })
    expect(rule._tag).toBe('Rule')
    expect(Rule.is(rule)).toBe(true)
    expect(rule.id).toBe('env.git-clean')
    expect(rule.preconditions).toHaveLength(0)
  })

  test('make with preconditions', () => {
    const rule = Rule.make({
      id: RuleId.makeUnsafe('pr.type.match-known'),
      description: 'PR type must be a known conventional commit type',
      preconditions: [HasOpenPR.make({})],
    })
    expect(rule.preconditions).toHaveLength(1)
    expect(rule.preconditions[0]!._tag).toBe('PreconditionHasOpenPR')
  })

  test('make with defaults', () => {
    const rule = Rule.make({
      id: RuleId.makeUnsafe('plan.tags-unique'),
      description: 'Planned tags must not already exist',
      preconditions: [HasReleasePlan.make({})],
      defaults: RuleDefaults.make({ enabled: true, severity: Severity.Warn.make({}) }),
    })
    expect(rule.defaults).toBeDefined()
    expect(rule.defaults!.enabled).toBe(true)
    expect(rule.defaults!.severity!._tag).toBe('SeverityWarn')
  })

  test('schema roundtrip', () => {
    const rule = Rule.make({
      id: RuleId.makeUnsafe('env.npm-authenticated'),
      description: 'npm must be authenticated',
      preconditions: [HasReleasePlan.make({})],
      defaults: RuleDefaults.make({ enabled: 'auto' }),
    })
    const encoded = Schema.encodeSync(Rule)(rule)
    const decoded = Schema.decodeSync(Rule)(encoded)
    expect(decoded.id).toBe('env.npm-authenticated')
    expect(decoded.preconditions).toHaveLength(1)
    expect(decoded.defaults!.enabled).toBe('auto')
  })
})
