import { describe, expect, it } from 'vite-plus/test'
import { Schema as S } from 'effect'
import { FastCheck } from 'effect/testing'
import * as Path from './__.js'

const encodedSchemas = [
  ['Segment', Path.Segment, Path.Testing.Segment],
  ['FileName', Path.FileName, Path.Testing.FileName],
  ['AbsDir', Path.AbsDir, Path.Testing.AbsDir],
  ['AbsFile', Path.AbsFile, Path.Testing.AbsFile],
  ['RelDir', Path.RelDir, Path.Testing.RelDir],
  ['RelFile', Path.RelFile, Path.Testing.RelFile],
  ['Any', Path.Any, Path.Testing.Any],
] as const

const realisticArbitraries = [
  ['Realistic.Segment', Path.Segment, Path.Testing.Realistic.Segment],
  ['Realistic.FileName', Path.FileName, Path.Testing.Realistic.FileName],
  ['Realistic.AbsDir', Path.AbsDir, Path.Testing.Realistic.AbsDir],
  ['Realistic.AbsFile', Path.AbsFile, Path.Testing.Realistic.AbsFile],
  ['Realistic.RelDir', Path.RelDir, Path.Testing.Realistic.RelDir],
  ['Realistic.RelFile', Path.RelFile, Path.Testing.Realistic.RelFile],
  ['Realistic.Any', Path.Any, Path.Testing.Realistic.Any],
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
