/**
 * Type-level bug captures for the 2026-06-23 audit (see
 * `packages/effect/docs/review-2026-06-23.md`). The type-level analyzer
 * (`path-analyzer/codec-string/analyzer.types.ts`) diverges from the runtime
 * analyzer.
 *
 * Each assertion states the CORRECT (runtime-matching) type and is currently wrong,
 * so it is wrapped in `@ts-expect-error`: the suppressed error keeps `check:types`
 * green WHILE the bug exists, and becomes an "unused @ts-expect-error" error (red)
 * the moment the type-level analyzer is fixed — at which point delete the directive
 * to leave a passing type test.
 */
import { expectTypeOf } from '@kitz/vitest'
import type { Analyze } from './path-analyzer/__.js'

// ANL-H1 — the path is dropped to `[]` for absolute files (runtime: ['home','user']).
// @ts-expect-error KNOWN BUG ANL-H1: type-level path is [] for absolute files
expectTypeOf<Analyze<'/home/user/config.json'>['path']>().toEqualTypeOf<['home', 'user']>()

// ANL-H2 — extension extraction is greedy (first dot); runtime uses the last dot.
// @ts-expect-error KNOWN BUG ANL-H2: type-level extension is '.test.ts', should be '.ts'
expectTypeOf<Analyze<'a/file.test.ts'>['file']['extension']>().toEqualTypeOf<'.ts'>()

// ANL-H3 — `..` is never resolved at the type level (runtime normalizes to path + back).
// @ts-expect-error KNOWN BUG ANL-H3: type-level path keeps '..', should be ['a']
expectTypeOf<Analyze<'../../a/file.txt'>['path']>().toEqualTypeOf<['a']>()
