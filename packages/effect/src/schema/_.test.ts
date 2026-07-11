/**
 * Schema namespace test suite — organized by FEATURE (see path/_.test.ts for
 * the principle statement).
 */
import { describe, expect, expectTypeOf, it } from '@kitz/vitest'
import { Schema as S } from 'effect'
import { FastCheck } from 'effect/testing'
import { Schema } from './_.js'
import { withArbitraryHints } from './withArbitraryHints.js'

describe('withStatics', () => {
  class Name extends Schema.withStatics(S.asClass(S.String)) {}

  it('attaches and inherits a schema-derived is guard', () => {
    expect(Name.is('Ada')).toBe(true)
    expect(Name.is(42)).toBe(false)

    const input: unknown = 'Grace'
    if (Name.is(input)) expectTypeOf(input).toEqualTypeOf<typeof Name.Type>()
  })

  it('owns its Guard type instead of leaking a bare Schema.Guard', () => {
    expectTypeOf<Schema.withStatics.Guard<typeof S.String>['is']>().toEqualTypeOf<
      (u: unknown) => u is string
    >()

    const staticRejection = () => {
      // @ts-expect-error Guard is owned by Schema.withStatics
      expectTypeOf<Schema.Guard<typeof S.String>>()
    }
    expect(typeof staticRejection).toBe('function')
  })
})

describe('withArbitraryHints', () => {
  const Base = S.String.pipe(S.check(S.makeFilter((s) => s.length >= 1, { message: 'non-empty' })))
  const Biased = Base.pipe(
    withArbitraryHints({
      candidate: { weight: 20, make: (fc) => fc.constantFrom('alpha', 'beta') },
    }),
  )

  it('biases generation toward the candidate while retaining the full space', () => {
    const samples = FastCheck.sample(S.toArbitrary(Biased), { numRuns: 1000, seed: 42 })
    const fromCandidate = samples.filter((s) => s === 'alpha' || s === 'beta')
    // expected fraction is 20/21 ≈ 0.95; base generator keeps weight 1
    expect(fromCandidate.length / samples.length).toBeGreaterThan(0.85)
    expect(fromCandidate.length).toBeLessThan(samples.length)
  })

  it('does not change the accepted set', () => {
    expect(S.decodeSync(Biased)('anything')).toBe('anything')
    expect(() => S.decodeSync(Biased)('')).toThrow()
  })

  it('is identity when no hints reach it at runtime', () => {
    const staticRejection = () => {
      // @ts-expect-error withArbitraryHints requires at least one arbitrary hint
      withArbitraryHints({})
      // @ts-expect-error an undefined constraint is not an arbitrary hint
      withArbitraryHints({ constraint: undefined })
      // @ts-expect-error an undefined candidate is not an arbitrary hint
      withArbitraryHints({ candidate: undefined })
    }
    const Unchanged = Base.pipe(withArbitraryHints({} as any))

    expect(typeof staticRejection).toBe('function')
    expect(Unchanged).toBe(Base)
    expect(S.toArbitrary(Unchanged, { report: true }).report).toEqual(
      S.toArbitrary(Base, { report: true }).report,
    )
  })

  it('candidate output is validated by the schema filters', () => {
    const InvalidCandidate = Base.pipe(
      withArbitraryHints({
        candidate: { weight: 20, make: (fc) => fc.constantFrom('ok', '') },
      }),
    )
    const samples = FastCheck.sample(S.toArbitrary(InvalidCandidate), { numRuns: 200, seed: 42 })
    expect(samples.every((s) => s.length >= 1)).toBe(true)
  })

  it('does not leak into the JSON Schema document', () => {
    expect(S.toJsonSchemaDocument(Biased)).toEqual(S.toJsonSchemaDocument(Base))
  })

  it('the hint carrier adds no derivation warnings', () => {
    // Base's own unhinted predicate filter IS an OpaqueFilter warning; the
    // carrier must not add a second one.
    const base = S.toArbitrary(Base, { report: true }).report.warnings
    const biased = S.toArbitrary(Biased, { report: true }).report.warnings
    expect(base).toEqual([{ _tag: 'OpaqueFilter', path: [] }])
    expect(biased).toEqual(base)
  })

  it('composes: a biased leaf flows through container derivation', () => {
    const Container = S.Struct({ items: S.Array(Biased) })
    const samples = FastCheck.sample(S.toArbitrary(Container), { numRuns: 300, seed: 42 })
    const items = samples.flatMap((s) => s.items)
    expect(items.length).toBeGreaterThan(0)
    const fromCandidate = items.filter((i) => i === 'alpha' || i === 'beta')
    expect(fromCandidate.length / items.length).toBeGreaterThan(0.85)
  })
})
