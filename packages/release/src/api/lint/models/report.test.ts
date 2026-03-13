import { Schema } from 'effect'
import { describe, expect, test } from 'vitest'
import { Failed, Finished, Report, RuleCheckResult, Skipped } from './report.js'
import { RuleDefaults, RuleId } from './rule-defaults.js'
import * as Severity from './severity.js'
import { Environment } from './violation-location.js'
import { Violation } from './violation.js'

const ruleRef = (id: string) => ({
  id: RuleId.makeUnsafe(id),
  description: 'Test rule',
})

describe('Finished', () => {
  test('clean result (no violation)', () => {
    const r = new Finished({
      rule: ruleRef('env.git-clean'),
      duration: 42,
      severity: new Severity.Error(),
    })
    expect(r._tag).toBe('RuleCheckResultFinished')
    expect(Finished.is(r)).toBe(true)
    expect(r.violation).toBeUndefined()
  })

  test('with violation', () => {
    const r = new Finished({
      rule: ruleRef('env.npm-authenticated'),
      duration: 100,
      severity: new Severity.Error(),
      violation: new Violation({
        location: new Environment({ message: 'Not logged in to npm.' }),
      }),
    })
    expect(r.violation).toBeDefined()
    expect(r.violation!.location._tag).toBe('ViolationLocationEnvironment')
  })

  test('with metadata', () => {
    const r = new Finished({
      rule: ruleRef('env.npm-authenticated'),
      duration: 50,
      severity: new Severity.Warn(),
      metadata: { username: 'testuser' },
    })
    expect(r.metadata).toEqual({ username: 'testuser' })
    expect(r.severity._tag).toBe('SeverityWarn')
  })
})

describe('Failed', () => {
  test('captures error', () => {
    const r = new Failed({
      rule: ruleRef('env.git-remote'),
      duration: 10,
      error: new Error('connection refused'),
    })
    expect(r._tag).toBe('RuleCheckResultFailed')
    expect(Failed.is(r)).toBe(true)
  })
})

describe('Skipped', () => {
  test('filtered reason', () => {
    const r = new Skipped({
      rule: ruleRef('pr.scope.require'),
      reason: 'filtered',
    })
    expect(r._tag).toBe('RuleCheckResultSkipped')
    expect(Skipped.is(r)).toBe(true)
    expect(r.reason).toBe('filtered')
  })

  test('preconditions-not-met reason', () => {
    const r = new Skipped({
      rule: ruleRef('pr.type.match-known'),
      reason: 'preconditions-not-met',
    })
    expect(r.reason).toBe('preconditions-not-met')
  })
})

describe('RuleCheckResult union', () => {
  test('schema roundtrip for Finished', () => {
    const r = new Finished({
      rule: ruleRef('env.git-clean'),
      duration: 42,
      severity: new Severity.Error(),
    })
    const encoded = Schema.encodeSync(RuleCheckResult)(r)
    const decoded = Schema.decodeSync(RuleCheckResult)(encoded)
    expect(decoded._tag).toBe('RuleCheckResultFinished')
  })

  test('schema roundtrip for Failed', () => {
    const r = new Failed({ rule: ruleRef('env.git-remote'), duration: 10, error: 'boom' })
    const encoded = Schema.encodeSync(RuleCheckResult)(r)
    const decoded = Schema.decodeSync(RuleCheckResult)(encoded)
    expect(decoded._tag).toBe('RuleCheckResultFailed')
  })

  test('schema roundtrip for Skipped', () => {
    const r = new Skipped({ rule: ruleRef('pr.scope.require'), reason: 'filtered' })
    const encoded = Schema.encodeSync(RuleCheckResult)(r)
    const decoded = Schema.decodeSync(RuleCheckResult)(encoded)
    expect(decoded._tag).toBe('RuleCheckResultSkipped')
  })
})

describe('Report', () => {
  test('make with mixed results', () => {
    const report = new Report({
      results: [
        new Finished({
          rule: ruleRef('env.git-clean'),
          duration: 10,
          severity: new Severity.Error(),
        }),
        new Failed({ rule: ruleRef('env.git-remote'), duration: 5, error: 'fail' }),
        new Skipped({ rule: ruleRef('pr.scope.require'), reason: 'filtered' }),
      ],
    })
    expect(Report.is(report)).toBe(true)
    expect(report.results).toHaveLength(3)
  })

  test('schema roundtrip', () => {
    const report = new Report({
      results: [
        new Finished({
          rule: ruleRef('env.git-clean'),
          duration: 10,
          severity: new Severity.Error(),
        }),
      ],
    })
    const encoded = Schema.encodeSync(Report)(report)
    const decoded = Schema.decodeSync(Report)(encoded)
    expect(decoded.results).toHaveLength(1)
  })
})
