import { Semver } from '@kitz/semver'
import { Effect, ParseResult, Schema as S } from 'effect'

export type SemverValue =
  | {
    readonly _tag: 'SemverOfficialRelease'
    readonly major: number
    readonly minor: number
    readonly patch: number
    readonly build?: ReadonlyArray<string> | undefined
    toString(): string
  }
  | {
    readonly _tag: 'SemverPreRelease'
    readonly major: number
    readonly minor: number
    readonly patch: number
    readonly prerelease: readonly [string | number, ...(string | number)[]]
    readonly build?: ReadonlyArray<string> | undefined
    toString(): string
  }

const isSemver = (input: unknown): input is SemverValue => Semver.is(input)

export const SemverSelf: S.Schema<SemverValue> = S.declare<SemverValue>(isSemver, {
  identifier: 'PkgSemverSelf',
  title: 'Semver',
})

export const SemverFromString: S.Schema<SemverValue, string> = S.transformOrFail(
  S.String,
  SemverSelf,
  {
    strict: true,
    decode: (value, _, ast) =>
      Effect.try({
        try: () => Semver.fromString(value) as SemverValue,
        catch: () => new ParseResult.Type(ast, value, 'Invalid semver format'),
      }),
    encode: (value) => ParseResult.succeed(Semver.toString(value as never)),
  },
)
