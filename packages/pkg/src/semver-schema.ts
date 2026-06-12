import { Semver } from '@kitz/semver'
// Imported via portable subpaths (not the barrel) so declaration emit can
// name the union members in downstream packages (TS2883).
import type { OfficialRelease } from '@kitz/semver/official-release'
import type { PreRelease } from '@kitz/semver/pre-release'
import { Effect, Option, SchemaGetter, SchemaIssue, Schema as S } from 'effect'

export type SemverValue = OfficialRelease | PreRelease

const isSemver = (input: unknown): input is SemverValue => Semver.is(input)

export const SemverSelf = S.declare<SemverValue>(isSemver, {
  identifier: 'PkgSemverSelf',
  title: 'Semver',
})

export const SemverFromString = S.String.pipe(
  S.decodeTo(SemverSelf, {
    decode: SchemaGetter.transformOrFail((value) =>
      Effect.try({
        try: () => Semver.fromString(value),
        catch: () =>
          new SchemaIssue.InvalidValue(Option.some(value), { message: 'Invalid semver format' }),
      }),
    ),
    encode: SchemaGetter.transform((value) => Semver.toString(value)),
  }),
)
