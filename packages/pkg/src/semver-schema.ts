import { Semver } from '@kitz/semver'
import { Effect, Option, SchemaGetter, SchemaIssue, Schema as S } from 'effect'

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

export const SemverSelf = S.declare<SemverValue>(isSemver, {
  identifier: 'PkgSemverSelf',
  title: 'Semver',
})

export const SemverFromString = S.String.pipe(
  S.decodeTo(SemverSelf, {
    decode: SchemaGetter.transformOrFail((value) =>
      Effect.try({
        try: () => Semver.fromString(value) as SemverValue,
        catch: () =>
          new SchemaIssue.InvalidValue(Option.some(value), { message: 'Invalid semver format' }),
      }),
    ),
    encode: SchemaGetter.transform((value) => Semver.toString(value as never)),
  }),
)
