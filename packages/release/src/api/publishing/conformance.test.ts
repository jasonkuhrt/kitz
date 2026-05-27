import { Array as A, HashSet } from 'effect'
import { describe, expect, test } from 'bun:test'
import * as Capability from './models/capability.js'
import { ConformanceReport, ConformanceScenarioResult, run } from './conformance.js'
import { FakeProvider } from './testing/__.js'

describe('publishing conformance runner', () => {
  test('reports every capability with stable scenario identifiers', () => {
    const provider = FakeProvider.make(Capability.publishCapabilityValues)
    const report = run(provider)

    expect(report.providerId).toBe('fake-registry')
    expect(ConformanceReport.is(report)).toBe(true)
    expect(report.productionSelectable).toBe(false)
    expect(report.results).toHaveLength(Capability.publishCapabilityValues.length)
    expect(ConformanceScenarioResult.is(report.results[0])).toBe(true)
    expect(report.results[0]?.scenarioId.startsWith('capability:')).toBe(true)
  })

  test('treats unsupported fake-registry capabilities as typed data', () => {
    const provider = FakeProvider.make(HashSet.empty())
    const report = run(provider)

    expect(A.every(report.results, (result) => result.result === 'unsupported')).toBe(true)
    expect(
      A.every(
        report.results,
        (result) => result.errorCode?.startsWith('release.conformance') === true,
      ),
    ).toBe(true)
  })

  test('turns invalid provider capability results into a stable conformance failure', () => {
    const provider = {
      id: 'bad-provider',
      capabilityResult: () => ({ nope: true }),
    }
    // @ts-expect-error This test proves the runtime conformance boundary rejects invalid providers.
    const report = run(provider)

    expect(report.productionSelectable).toBe(true)
    expect(report.results[0]?.isSupported).toBe(false)
    expect(report.results[0]).toMatchObject({
      providerId: 'bad-provider',
      capability: Capability.publishCapabilityValues[0],
      scenarioId: `capability:${Capability.publishCapabilityValues[0]}`,
      result: 'unsupported',
      evidence: ['provider returned invalid capability result'],
      errorCode: 'release.conformance.invalid-capability-result',
    })
  })
})
