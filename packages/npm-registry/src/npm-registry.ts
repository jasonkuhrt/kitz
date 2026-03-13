import { HttpClient, HttpClientError } from 'effect/unstable/http'
import { Err } from '@kitz/core'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { Effect, Option, Schema as S } from 'effect'

// ============================================================================
// Errors
// ============================================================================

const baseTags = ['kit', 'npm-registry'] as const

const NpmRegistryOperationSchema = S.Literals(['getVersions', 'getLatestVersion'])
const ErrorCause = S.instanceOf(Error)
const NpmRegistryErrorContext = S.Struct({
  operation: NpmRegistryOperationSchema,
  packageName: S.String,
  detail: S.optional(S.String),
})
const SemverParseErrorContext = S.Struct({
  version: S.String,
  packageName: S.String,
})

/**
 * Npm registry operation names for structured error context.
 */
export type NpmRegistryOperation = typeof NpmRegistryOperationSchema.Type

/**
 * Npm registry operation error.
 */
export const NpmRegistryError: Err.TaggedContextualErrorClass<
  'NpmRegistryError',
  typeof baseTags,
  typeof NpmRegistryErrorContext,
  typeof ErrorCause
> = Err.TaggedContextualError('NpmRegistryError', baseTags, {
  context: NpmRegistryErrorContext,
  message: (ctx) =>
    `npm registry ${ctx.operation} for ${ctx.packageName} failed${ctx.detail ? `: ${ctx.detail}` : ''}`,
  cause: ErrorCause,
})

export type NpmRegistryError = InstanceType<typeof NpmRegistryError>

/**
 * Error parsing a version string from the registry.
 */
export const SemverParseError: Err.TaggedContextualErrorClass<
  'SemverParseError',
  typeof baseTags,
  typeof SemverParseErrorContext,
  typeof ErrorCause
> = Err.TaggedContextualError('SemverParseError', baseTags, {
  context: SemverParseErrorContext,
  message: (ctx) => `invalid semver "${ctx.version}" from package ${ctx.packageName}`,
  cause: ErrorCause,
})

export type SemverParseError = InstanceType<typeof SemverParseError>

// ============================================================================
// Options & Helpers
// ============================================================================

/**
 * Options for registry queries.
 */
export interface RegistryOptions {
  /** Registry URL (defaults to https://registry.npmjs.org) */
  readonly registry?: string
}

const DEFAULT_REGISTRY = 'https://registry.npmjs.org'

/**
 * Fetch package metadata from npm registry.
 */
const fetchPackageMetadata = <$data>(
  moniker: Pkg.Moniker.Moniker,
  operation: NpmRegistryOperation,
  options: RegistryOptions | undefined,
): Effect.Effect<Option.Option<$data>, NpmRegistryError, HttpClient.HttpClient> => {
  const registry = options?.registry ?? DEFAULT_REGISTRY
  const url = `${registry}/${moniker.encoded}`

  return HttpClient.get(url).pipe(
    Effect.flatMap((response) => {
      if (response.status === 404) {
        return Effect.succeed(Option.none<$data>())
      }
      return response.json.pipe(Effect.map((data) => Option.some(data as $data)))
    }),
    Effect.catchTag('HttpClientError', (error) => {
      // Check if it's a response-level error with a status code
      const reason = error.reason
      if ('response' in reason && (reason as any).response?.status === 404) {
        return Effect.succeed(Option.none<$data>())
      }
      // Check if it's a response error and include status detail
      const detail = 'response' in reason ? `status ${(reason as any).response?.status}` : undefined
      return Effect.fail(
        new NpmRegistryError({
          context: {
            operation,
            packageName: moniker.moniker,
            detail,
          },
          cause: error,
        }),
      )
    }),
  )
}

/**
 * Parse a version string, returning an Effect that fails with SemverParseError.
 */
const parseVersion = (
  version: string,
  packageName: string,
): Effect.Effect<Semver.Semver, SemverParseError> =>
  Effect.try({
    try: () => Semver.fromString(version),
    catch: (cause) =>
      new SemverParseError({
        context: { version, packageName },
        cause: cause instanceof Error ? cause : new Error(String(cause)),
      }),
  })

// ============================================================================
// Public API
// ============================================================================

/**
 * Get all published versions of a package.
 *
 * @example
 * ```ts
 * const versions = await Effect.runPromise(
 *   getVersions('@kitz/core').pipe(Effect.provide(FetchHttpClient.layer))
 * )
 * // [Semver.Semver, Semver.Semver, ...]
 * ```
 */
export function getVersions(
  packageName: string,
  options?: RegistryOptions,
): Effect.Effect<Semver.Semver[], NpmRegistryError | SemverParseError, HttpClient.HttpClient> {
  const moniker = Pkg.Moniker.parse(packageName)

  return fetchPackageMetadata<{ versions?: Record<string, unknown> }>(
    moniker,
    'getVersions',
    options,
  ).pipe(
    Effect.flatMap((dataOption) => {
      if (Option.isNone(dataOption)) return Effect.succeed([])
      const versionStrings = Object.keys(dataOption.value.versions ?? {})
      return Effect.all(versionStrings.map((v) => parseVersion(v, packageName)))
    }),
  )
}

/**
 * Get the latest published version of a package.
 *
 * @example
 * ```ts
 * const latest = await Effect.runPromise(
 *   getLatestVersion('@kitz/core').pipe(Effect.provide(FetchHttpClient.layer))
 * )
 * // Option.Option<Semver.Semver>
 * ```
 */
export function getLatestVersion(
  packageName: string,
  options?: RegistryOptions,
): Effect.Effect<
  Option.Option<Semver.Semver>,
  NpmRegistryError | SemverParseError,
  HttpClient.HttpClient
> {
  const moniker = Pkg.Moniker.parse(packageName)

  return fetchPackageMetadata<{ 'dist-tags'?: { latest?: string } }>(
    moniker,
    'getLatestVersion',
    options,
  ).pipe(
    Effect.flatMap((dataOption) => {
      if (Option.isNone(dataOption)) return Effect.succeed(Option.none())
      const latest = dataOption.value['dist-tags']?.latest
      if (!latest) return Effect.succeed(Option.none())
      return parseVersion(latest, packageName).pipe(Effect.map(Option.some))
    }),
  )
}
