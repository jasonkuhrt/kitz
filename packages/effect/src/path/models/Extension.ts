import { Schema as S } from 'effect'

/**
 * A file extension starting with a dot (e.g. `.ts`). POSIX-compliant: any
 * character except `/` (NUL is unrepresentable in JS strings).
 */
class Extension_ extends S.asClass(
  S.String.pipe(
    S.check(S.isPattern(/^\.[^/]+$/)),
    S.annotate({ description: 'A file extension starting with a dot (POSIX-compliant)' }),
  ),
) {}

export const Extension = Extension_
export type Extension = typeof Extension_.Type
