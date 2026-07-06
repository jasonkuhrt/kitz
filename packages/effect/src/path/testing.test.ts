import { describe, expect, it } from 'vite-plus/test'
import { Schema as S } from 'effect'
import { FastCheck } from 'effect/testing'
import * as Path from './__.js'
import * as PathTesting from './testing.js'

const encodedSchemas = [
  ['Segment', Path.Segment, PathTesting.Segment],
  ['FileName', Path.FileName, PathTesting.FileName],
  ['AbsDir', Path.AbsDir, PathTesting.AbsDir],
  ['AbsFile', Path.AbsFile, PathTesting.AbsFile],
  ['RelDir', Path.RelDir, PathTesting.RelDir],
  ['RelFile', Path.RelFile, PathTesting.RelFile],
  ['Any', Path.Any, PathTesting.Any],
] as const

const realisticArbitraries = [
  ['Realistic.Segment', Path.Segment, PathTesting.Realistic.Segment],
  ['Realistic.FileName', Path.FileName, PathTesting.Realistic.FileName],
  ['Realistic.AbsDir', Path.AbsDir, PathTesting.Realistic.AbsDir],
  ['Realistic.AbsFile', Path.AbsFile, PathTesting.Realistic.AbsFile],
  ['Realistic.RelDir', Path.RelDir, PathTesting.Realistic.RelDir],
  ['Realistic.RelFile', Path.RelFile, PathTesting.Realistic.RelFile],
  ['Realistic.Any', Path.Any, PathTesting.Realistic.Any],
] as const

describe('Path.Testing arbitraries', () => {
  it.each([...encodedSchemas, ...realisticArbitraries])(
    '%s encodes 500 sampled values',
    (_, schema, arbitrary) => {
      const encode = S.encodeSync(schema)
      for (const value of FastCheck.sample(arbitrary as FastCheck.Arbitrary<unknown>, 500)) {
        expect(() => encode(value as never)).not.toThrow()
      }
    },
  )

  it.each(encodedSchemas)('%s derives without opaque-filter warnings', (_, schema) => {
    const derivation = S.toArbitrary(schema, { report: true })
    expect(derivation.report.warnings).toEqual([])
  })
})
