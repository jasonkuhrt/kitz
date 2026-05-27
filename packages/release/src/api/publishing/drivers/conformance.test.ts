import { describe, expect, test } from 'bun:test'
import * as Capability from '../models/capability.js'
import { Bun, Npm, Pnpm } from '../providers/__.js'

const providers = [Npm, Pnpm, Bun]

describe('publishing provider conformance', () => {
  test('every provider returns typed support or typed unsupported data for every capability', () => {
    for (const provider of providers) {
      for (const capability of Capability.publishCapabilityValues) {
        expect(Capability.isResult(provider.capabilityResult(capability))).toBe(true)
      }
    }
  })
})
