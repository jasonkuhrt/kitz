import { Array as A, HashMap, HashSet, Schema } from 'effect'
import { describe, expect, test } from 'bun:test'
import {
  capabilityMatrix,
  CapabilityMatrixRow,
  capabilityMatrixByCapability,
  isResult,
  PublishCapability,
  publishCapabilityValues,
  Unsupported,
} from './capability.js'
import { PublishingCapabilityError } from '../errors.js'

describe('publishing capability model', () => {
  test('capability union rejects unknown strings', () => {
    expect(Schema.decodeUnknownSync(PublishCapability)('publish:tarball')).toBe('publish:tarball')
    expect(() => Schema.decodeUnknownSync(PublishCapability)('publish:magic')).toThrow()
  })

  test('generated matrix has exactly one row for every capability atom', () => {
    const rowCapabilities = A.map(capabilityMatrix, (row) => row.capability)

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

  test('matrix rows own provider support lookups', () => {
    const row = CapabilityMatrixRow.fromCapability('trust:setup-github')

    expect(CapabilityMatrixRow.fromCapability('tool:version-proof').owner).toBe('packagemanager')
    expect(CapabilityMatrixRow.fromCapability('pack:tarball').owner).toBe('packagemanager')
    expect(CapabilityMatrixRow.fromCapability('publish:tarball').owner).toBe('packagemanager')
    expect(CapabilityMatrixRow.fromCapability('registry:view-version').owner).toBe(
      'packageregistry',
    )
    expect(CapabilityMatrixRow.fromCapability('credential:whoami').owner).toBe('credentials')
    expect(row.owner).toBe('credentials')
    expect(row.supportedProviderIds).toEqual(['npm'])
    expect(row.resultForProvider('npm').isSupported).toBe(true)
    expect(Unsupported.is(row.resultForProvider('pnpm'))).toBe(true)
  })

  test('unsupported capability support is data, not a thrown missing method', () => {
    const result = Unsupported.from({
      capability: 'publish:ignore-scripts',
      provider: 'bun',
      reason: 'not-supported-by-provider',
      evidence: ['bun publish docs omit an ignore-scripts flag'],
      blockingPlanFields: ['publishIntent.artifacts.scriptPolicy'],
    })

    expect(isResult(result)).toBe(true)
    expect(result.isSupported).toBe(false)
    expect(result.supportState).toBe('unsupported')
    expect(result.conformanceErrorCode).toBe(
      'release.conformance.unsupported.publish.ignore-scripts',
    )
    expect(result.blockingPlanFields).toEqual(['publishIntent.artifacts.scriptPolicy'])
  })

  test('capability errors carry provider and operation context', () => {
    const error = new PublishingCapabilityError({
      context: {
        provider: 'bun',
        operation: 'publish:ignore-scripts',
      },
    })

    expect(error).toBeInstanceOf(PublishingCapabilityError)
    expect(error.message).toBe('Provider bun cannot prove publish:ignore-scripts')
    expect(error.context).toEqual({
      provider: 'bun',
      operation: 'publish:ignore-scripts',
    })
  })
})
