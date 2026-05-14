import { Schema } from 'effect'
import { describe, expect, test } from 'bun:test'
import { CapabilityResult, publishCapabilityValues } from '../models/capability.js'
import { Bun, Npm, Pnpm } from '../providers/__.js'

const providers = [Npm, Pnpm, Bun] as const

describe('publishing provider conformance', () => {
  test('every provider returns typed support or typed unsupported data for every capability', () => {
    for (const provider of providers) {
      for (const capability of publishCapabilityValues) {
        expect(Schema.is(CapabilityResult)(provider.capabilityResult(capability))).toBe(true)
      }
    }
  })
})
