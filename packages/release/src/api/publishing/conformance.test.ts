import { HashSet } from 'effect'
import { describe, expect, test } from 'bun:test'
import { publishCapabilityValues } from './models/capability.js'
import { run } from './conformance.js'
import { FakeProvider } from './testing/__.js'

describe('publishing conformance runner', () => {
  test('reports every capability with stable scenario identifiers', () => {
    const provider = FakeProvider.make(publishCapabilityValues)
    const report = run(provider)

    expect(report.providerId).toBe('fake-registry')
    expect(report.productionSelectable).toBe(false)
    expect(report.results).toHaveLength(publishCapabilityValues.length)
    expect(report.results[0]?.scenarioId.startsWith('capability:')).toBe(true)
  })

  test('treats unsupported fake-registry capabilities as typed data', () => {
    const provider = FakeProvider.make(HashSet.empty())
    const report = run(provider)

    expect(report.results.every((result) => result.result === 'unsupported')).toBe(true)
    expect(
      report.results.every((result) => result.errorCode?.startsWith('release.conformance')),
    ).toBe(true)
  })

  test('turns invalid provider capability results into a stable conformance failure', () => {
    const report = run({
      id: 'bad-provider',
      capabilityResult: () => ({ nope: true }) as any,
    })

    expect(report.productionSelectable).toBe(true)
    expect(report.results[0]).toEqual({
      providerId: 'bad-provider',
      capability: publishCapabilityValues[0],
      scenarioId: `capability:${publishCapabilityValues[0]}`,
      result: 'unsupported',
      evidence: ['provider returned invalid capability result'],
      errorCode: 'release.conformance.invalid-capability-result',
    })
  })
})
