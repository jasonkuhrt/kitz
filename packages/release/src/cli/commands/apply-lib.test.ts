import { Effect } from 'effect'
import { describe, expect, test } from 'bun:test'
import * as Api from '../../api/__.js'
import {
  applyPreflightGateOrder,
  applyPreflightGates,
  renderIssueLines,
  runPreflightGates,
  type PreflightGate,
} from './apply-lib.js'
import { hasExecutablePlanContract } from './plan-file.js'

const makeExecutablePlan = () => {
  const plan = Api.Planner.Plan.make({
    lifecycle: 'official',
    timestamp: '2026-06-09T00:00:00.000Z',
    releases: [],
    cascades: [],
    planDigest: Api.ReleaseContract.PlanDigest.make({
      algorithm: 'sha256',
      value: 'a'.repeat(64),
    }),
    publishIntent: Api.ReleaseContract.publishIntentFromSemantics({
      semantics: Api.Publishing.resolvePublishSemantics({ lifecycle: 'official' }),
      trunk: 'main',
    }),
  })
  if (!hasExecutablePlanContract(plan)) {
    throw new Error('fixture plan must carry the frozen execution contract')
  }
  return plan
}

const passingGate = (id: string, log: string[]): PreflightGate<never, never> => ({
  id,
  run: Effect.sync(() => {
    log.push(id)
    return null
  }),
})

const failingGate = (
  id: string,
  log: string[],
  lines: readonly string[],
): PreflightGate<never, never> => ({
  id,
  run: Effect.sync(() => {
    log.push(id)
    return lines
  }),
})

describe('runPreflightGates', () => {
  test('runs gates strictly in order and passes when every gate passes', async () => {
    const log: string[] = []
    const result = await Effect.runPromise(
      runPreflightGates([passingGate('a', log), passingGate('b', log), passingGate('c', log)]),
    )

    expect(result).toBeNull()
    expect(log).toEqual(['a', 'b', 'c'])
  })

  test('stops at the first failing gate without running later gates', async () => {
    const log: string[] = []
    const result = await Effect.runPromise(
      runPreflightGates([
        passingGate('a', log),
        failingGate('b', log, ['headline', 'detail']),
        passingGate('c', log),
      ]),
    )

    expect(result).toEqual({ gateId: 'b', lines: ['headline', 'detail'] })
    expect(log).toEqual(['a', 'b'])
  })
})

describe('applyPreflightGates', () => {
  test('declares the canonical gate order: proof, artifacts, source-snapshot, script-policy, engine-policy', () => {
    const gates = applyPreflightGates(makeExecutablePlan())

    expect(gates.map((gate) => gate.id)).toEqual([...applyPreflightGateOrder])
    expect(applyPreflightGateOrder).toEqual([
      'proof',
      'artifacts',
      'source-snapshot',
      'script-policy',
      'engine-policy',
    ])
  })
})

describe('renderIssueLines', () => {
  test('renders code: detail pairs', () => {
    expect(
      renderIssueLines([
        { code: 'missing-file', detail: 'tarball not found' },
        { code: 'sha-mismatch', detail: 'expected abc, observed def' },
      ]),
    ).toEqual(['missing-file: tarball not found', 'sha-mismatch: expected abc, observed def'])
  })
})
