import { HashMap, HashSet, Schema } from 'effect'
import { describe, expect, test } from 'bun:test'
import {
  capabilityMatrix,
  CapabilityMatrixRow,
  capabilityMatrixByCapability,
  CapabilityResult,
  PublishCapability,
  publishCapabilityValues,
  unsupported,
} from './capability.js'
import { PublishingCapabilityError } from '../errors.js'

describe('publishing capability model', () => {
  test('capability union rejects unknown strings', () => {
    expect(Schema.decodeUnknownSync(PublishCapability)('publish:tarball')).toBe('publish:tarball')
    expect(() => Schema.decodeUnknownSync(PublishCapability)('publish:magic')).toThrow()
  })

  test('generated matrix has exactly one row for every capability atom', () => {
    const rowCapabilities = capabilityMatrix.map((row) => row.capability)

    expect(HashSet.size(HashSet.fromIterable(rowCapabilities))).toBe(publishCapabilityValues.length)
    expect(rowCapabilities.toSorted()).toEqual([...publishCapabilityValues].toSorted())
    expect(HashMap.size(capabilityMatrixByCapability)).toBe(publishCapabilityValues.length)
  })

  test('every row has owner, evidence, conformance, and provider support entries', () => {
    for (const row of capabilityMatrix) {
      expect(CapabilityMatrixRow.is(row)).toBe(true)
      expect(row.owner.length).toBeGreaterThan(0)
      expect(row.evidence).not.toHaveLength(0)
      expect(row.conformance).not.toHaveLength(0)
      expect(row.providers['npm']).toMatch(/^(supported|unsupported)$/)
      expect(row.providers['pnpm']).toMatch(/^(supported|unsupported)$/)
      expect(row.providers['bun']).toMatch(/^(supported|unsupported)$/)
    }
  })

  test('unsupported capability support is data, not a thrown missing method', () => {
    const result = unsupported({
      capability: 'publish:ignore-scripts',
      provider: 'bun',
      reason: 'not-supported-by-provider',
      evidence: ['bun publish docs omit an ignore-scripts flag'],
      blockingPlanFields: ['publishIntent.artifacts.scriptPolicy'],
    })

    expect(Schema.is(CapabilityResult)(result)).toBe(true)
    expect(result._tag).toBe('Unsupported')
    if (result._tag === 'Unsupported') {
      expect(result.blockingPlanFields).toEqual(['publishIntent.artifacts.scriptPolicy'])
    }
  })

  test('capability errors carry provider and operation context', () => {
    const error = new PublishingCapabilityError('provider cannot prove operation', {
      provider: 'bun',
      operation: 'publish:ignore-scripts',
    })

    expect(error._tag).toBe('PublishingCapabilityError')
    expect(error.message).toBe('provider cannot prove operation')
    expect(error.context).toEqual({
      provider: 'bun',
      operation: 'publish:ignore-scripts',
    })
  })
})
