import { Schema as S } from 'effect'

const nullByte = String.fromCharCode(0)
const extensionPatternSource = `^\\.[^/${nullByte}]+$`

/**
 * A file extension starting with a dot (e.g. `.ts`). POSIX-safe: any
 * character except `/` or NUL after the dot.
 */
export const Extension = S.String.pipe(
  S.check(
    S.isPattern(new RegExp(extensionPatternSource), {
      arbitrary: {
        // Keep the pattern constraint for the base generator (printable
        // ASCII) and add a full-codepoint source at equal weight, keeping
        // canonical generation domain-faithful.
        constraint: { patterns: [extensionPatternSource] },
        candidate: {
          weight: 1,
          make: (fc: typeof import('effect/testing').FastCheck) =>
            fc
              .string({ unit: 'binary', minLength: 1, maxLength: 8 })
              .filter((s) => !s.includes('/') && !s.includes(nullByte))
              .map((s) => `.${s}`),
        },
      },
    }),
  ),
  S.annotate({ description: 'A file extension starting with a dot (POSIX-compliant)' }),
)

export type Extension = typeof Extension.Type
