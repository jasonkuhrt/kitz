/**
 * Shared test-only helpers and fast-check arbitraries for the release package.
 *
 * Excluded from the published build via `tsconfig.build.json` (same mechanism
 * as `src/api/executor/test-support.ts`); only `*.test.ts(x)` files may import
 * this module.
 */
import { Fs } from '@kitz/fs'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { Test } from '@kitz/test'
import { expect } from 'bun:test'
import { Schema } from 'effect'
import * as fc from 'fast-check'
import { ResolvedConfig, resolveConventionalCommitTypes } from './api/config.js'
import * as LintConfig from './api/lint/models/config.js'
import { ResolvedOperator } from './api/operator.js'
import { defaultPublishing } from './api/publishing.js'

/**
 * Register a property test asserting `decode ∘ encode = id` for a persisted
 * contract schema over arbitrary schema-valid values.
 *
 * The arbitrary defaults to `Schema.toArbitrary(schema)`. Pass an explicit
 * arbitrary for schemas whose leaf classes admit type-side values that violate
 * their encoded contract (e.g. `Pkg.Moniker` instances with `/` in the scope).
 */
export const roundtrips = <
  $Schema extends Schema.Top & Schema.Decoder<unknown> & Schema.Encoder<unknown>,
>(
  name: string,
  schema: $Schema,
  arbitrary: fc.Arbitrary<$Schema['Type']> = Schema.toArbitrary(schema),
): void => {
  Test.property(`${name} decode∘encode = id`, arbitrary, (value) => {
    const decoded = Schema.decodeSync(schema)(Schema.encodeSync(schema)(value))
    expect(decoded).toEqual(value)
  })
}

// ============================================================================
// Leaf arbitraries
//
// Derived straight from the domain schemas (their field grammars and
// canonical-form generator annotations make generated values contract-valid
// on both the type and encoded side — pinned by property tests in
// @kitz/pkg, @kitz/semver, and @kitz/fs).
// ============================================================================

/** Lowercase identifier-ish word: package scopes, path segments, file stems. */
export const arbWord: fc.Arbitrary<string> = fc.stringMatching(/^[a-z][a-z0-9-]{0,8}$/)

export const arbMoniker: fc.Arbitrary<Pkg.Moniker.Moniker> = Schema.toArbitrary(
  Pkg.Moniker.FromString,
)

export const arbSemver: fc.Arbitrary<Semver.Semver> = Schema.toArbitrary(Semver.Semver)

export const arbBump: fc.Arbitrary<Semver.BumpType> = fc.constantFrom('major', 'minor', 'patch')

/** ISO-8601 instants between 1970 and 2100 (deterministic, no `Date.now`). */
export const arbIso: fc.Arbitrary<string> = fc
  .integer({ min: 0, max: 4_102_444_800_000 })
  .map((epochMs) => new Date(epochMs).toISOString())

export const arbAbsFile: fc.Arbitrary<Fs.Path.AbsFile> = Schema.toArbitrary(Fs.Path.AbsFile.Schema)

export const arbRelFile: fc.Arbitrary<Fs.Path.RelFile> = Schema.toArbitrary(Fs.Path.RelFile.Schema)

/** Arbitrary JSON-serializable record (matches the contract `JsonRecord`s). */
export const arbJsonRecord: fc.Arbitrary<Record<string, unknown>> = fc.dictionary(
  fc.string(),
  fc.jsonValue(),
)

// ============================================================================
// Resolved-config fixtures
// ============================================================================

/** Canonical resolved operator for tests; overrides replace fields wholesale. */
export const testOperator = (
  overrides: Partial<Parameters<typeof ResolvedOperator.make>[0]> = {},
): ResolvedOperator =>
  ResolvedOperator.make({
    manager: Pkg.Manager.DetectedPackageManager.make({
      name: 'bun',
      source: 'runtime',
    }),
    releaseCommand: 'bun run release',
    prepareCommands: [],
    ...overrides,
  })

/**
 * Canonical resolved release config for tests.
 *
 * Overrides replace fields wholesale: pass `operator: testOperator({...})` to
 * vary a single operator field, `lint: Api.Lint.resolveConfig({...})` to vary
 * lint rules, etc.
 */
export const testConfig = (
  overrides: Partial<Parameters<typeof ResolvedConfig.make>[0]> = {},
): ResolvedConfig =>
  ResolvedConfig.make({
    trunk: 'main',
    npmTag: 'latest',
    candidateTag: 'next',
    packages: {},
    publishing: defaultPublishing(),
    operator: testOperator(),
    resolvedConventionalCommitTypes: resolveConventionalCommitTypes({}),
    commitOverrides: {},
    lint: LintConfig.resolveConfig({}),
    ...overrides,
  })
