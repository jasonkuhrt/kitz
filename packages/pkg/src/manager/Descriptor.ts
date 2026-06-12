import { Effect, Option, SchemaGetter, SchemaIssue, Schema as S } from 'effect'
import { Moniker } from '#moniker'

/**
 * Corepack `packageManager` field descriptor: `<name>[@<version>]`.
 *
 * Examples: `pnpm@10.7.0`, `yarn@3.2.3+sha224.953c8233...`, `bun`,
 * `@scope/manager@1.2.3`.
 *
 * The version segment is everything after the last `@` separator (the last
 * separator so scoped names parse correctly) and is kept as an opaque string:
 * corepack allows exact semver plus an optional `+<hash>` suffix, and some
 * consumers interpret it as a range, so semver validation belongs to the
 * consumer. A descriptor without a version (`bun`, `@scope/manager`) decodes
 * with `version: Option.none()`.
 *
 * @see {@link https://nodejs.org/api/packages.html#packagemanager | Node.js packageManager field}
 */
export class Descriptor extends S.Class<Descriptor>('PackageManagerDescriptor')({
  name: Moniker.FromString,
  version: S.OptionFromUndefinedOr(S.String),
}) {
  static is = S.is(Descriptor)
  static decode = S.decodeUnknownEffect(Descriptor)
  static decodeSync = S.decodeUnknownSync(Descriptor)
  static encode = S.encodeUnknownEffect(Descriptor)
  static encodeSync = S.encodeUnknownSync(Descriptor)
  static equivalence = S.toEquivalence(Descriptor)
  static ordered = false as const

  /**
   * String codec for package-manager descriptors.
   *
   * Parses `<name>[@<version>]` strings into {@link Descriptor}.
   * Malformed input (empty string, empty name, trailing `@` with an empty
   * version) fails with schema issues.
   */
  static FromString: S.Codec<Descriptor, string> = S.String.pipe(
    S.decodeTo(Descriptor, {
      decode: SchemaGetter.transformOrFail((value) => {
        // The last '@' separates name from version; an '@' at index 0 is a
        // scope marker (@scope/name), not a separator.
        const atIndex = value.lastIndexOf('@')
        const hasVersion = atIndex > 0
        const rawName = hasVersion ? value.slice(0, atIndex) : value
        const rawVersion = hasVersion ? value.slice(atIndex + 1) : undefined

        if (rawVersion === '') {
          return Effect.fail(
            new SchemaIssue.InvalidValue(Option.some(value), {
              message: `Invalid package-manager descriptor: expected '<name>@<version>'`,
            }),
          )
        }

        const name = S.decodeUnknownOption(Moniker.FromString)(rawName)
        if (Option.isNone(name)) {
          return Effect.fail(
            new SchemaIssue.InvalidValue(Option.some(value), {
              message: `Invalid package-manager name in descriptor`,
            }),
          )
        }

        return Effect.succeed({
          name: name.value.moniker,
          version: rawVersion,
        })
      }),
      encode: SchemaGetter.transform((descriptor) =>
        descriptor.version === undefined
          ? descriptor.name
          : `${descriptor.name}@${descriptor.version}`,
      ),
    }),
  )

  /**
   * Parse a package-manager descriptor from string.
   *
   * @example
   * ```ts
   * const descriptor = Descriptor.fromString('pnpm@10.7.0')
   * //    ^? Descriptor
   * ```
   */
  static fromString = S.decodeSync(Descriptor.FromString)
}
