import { Test } from '@kitz/test'
import { Exit, Schema } from 'effect'
import { describe, expect, test } from 'vitest'
import { RuleDefaults, RuleId } from './rule-defaults.js'
import * as Severity from './severity.js'

// ── RuleId ───────────────────────────────────────────────────────────

describe('RuleId', () => {
  Test.describe('valid patterns')
    .inputType<string>()
    .outputType<boolean>()
    .cases(
      { input: 'pr.type.match-known', output: true, comment: 'multi-segment with hyphen' },
      { input: 'env.git-clean', output: true, comment: 'two segments with hyphen' },
      { input: 'repo.squash-only', output: true, comment: 'two segments with hyphen' },
      { input: 'env.npm-authenticated', output: true, comment: 'standard lint rule' },
      { input: 'plan.tags-unique', output: true, comment: 'plan category' },
    )
    .test(({ input, output }) => {
      const result = Schema.decodeUnknownExit(RuleId)(input)
      expect(Exit.isSuccess(result)).toBe(output)
    })

  Test.describe('invalid patterns')
    .inputType<string>()
    .outputType<boolean>()
    .cases(
      { input: 'invalid', output: false, comment: 'single segment' },
      { input: 'UPPER.case', output: false, comment: 'uppercase letters' },
      { input: 'has spaces.rule', output: false, comment: 'spaces' },
      { input: '.leading-dot', output: false, comment: 'leading dot' },
      { input: 'trailing.dot.', output: false, comment: 'trailing dot' },
      { input: '', output: false, comment: 'empty string' },
    )
    .test(({ input, output }) => {
      const result = Schema.decodeUnknownExit(RuleId)(input)
      expect(Exit.isSuccess(result)).toBe(output)
    })

  test('RuleId.make creates branded value', () => {
    const id = RuleId.makeUnsafe('env.git-clean')
    expect(id).toBe('env.git-clean')
  })
})

// ── RuleDefaults ─────────────────────────────────────────────────────

describe('RuleDefaults', () => {
  test('make with no fields', () => {
    const d = new RuleDefaults({})
    expect(d._tag).toBe('RuleDefaults')
    expect(RuleDefaults.is(d)).toBe(true)
  })

  test('make with enabled=true', () => {
    const d = new RuleDefaults({ enabled: true })
    expect(d.enabled).toBe(true)
  })

  test('make with enabled=false', () => {
    const d = new RuleDefaults({ enabled: false })
    expect(d.enabled).toBe(false)
  })

  test('make with enabled=auto', () => {
    const d = new RuleDefaults({ enabled: 'auto' })
    expect(d.enabled).toBe('auto')
  })

  test('make with severity', () => {
    const d = new RuleDefaults({ severity: new Severity.Warn({}) })
    expect(d.severity!._tag).toBe('SeverityWarn')
  })

  test('schema roundtrip', () => {
    const d = new RuleDefaults({ enabled: true, severity: new Severity.Error({}) })
    const encoded = Schema.encodeSync(RuleDefaults)(d)
    const decoded = Schema.decodeSync(RuleDefaults)(encoded)
    expect(decoded.enabled).toBe(true)
    expect(decoded.severity!._tag).toBe('SeverityError')
  })
})
