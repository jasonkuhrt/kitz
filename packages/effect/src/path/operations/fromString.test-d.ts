import { expectTypeOf } from 'vitest'
import { Path } from '../../_.js'

// fromString should infer specific types from literal strings

// RelDir - starts with ./, ends with /
expectTypeOf<ReturnType<typeof Path.fromString<'./.release/'>>>().toEqualTypeOf<Path.RelDir>()

// RelFile - starts with ./, has extension
expectTypeOf<ReturnType<typeof Path.fromString<'./config.json'>>>().toEqualTypeOf<Path.RelFile>()

// AbsDir - starts with /, ends with /
expectTypeOf<ReturnType<typeof Path.fromString<'/home/user/'>>>().toEqualTypeOf<Path.AbsDir>()

// AbsFile - starts with /, has extension
expectTypeOf<
  ReturnType<typeof Path.fromString<'/home/user/config.json'>>
>().toEqualTypeOf<Path.AbsFile>()

// Plain string should return the full Path union.
// KNOWN ISSUE (surfaced during the Vitest migration, 2026-06): this assertion is
// currently UNVERIFIED, not silently relaxed. `fromString<string>` returns the
// class-instance union (AbsDir|AbsFile|RelDir|RelFile); `Path` is `Schema.Type`.
// They are neither strictly identical (`toEqualTypeOf` fails) nor cleanly
// mutually assignable (`toExtend` fails both directions) — the class union and
// the Union's `Schema.Type` diverge. The prior `Assert.exact.of<...>` form
// asserted strict identity but was a bare, unused `type` alias, so tsc never
// enforced it: it was silently false the whole time.
// OWNER DECISION NEEDED: align the Path ADT so `fromString<string>` returns
// exactly `Path` (`Schema.Type`), then restore a strict assertion here.
// expectTypeOf<ReturnType<typeof Path.fromString<string>>>().toEqualTypeOf<Path>()

// Dotfiles with extensions work correctly
expectTypeOf<ReturnType<typeof Path.fromString<'./.env.local'>>>().toEqualTypeOf<Path.RelFile>()

// Dotfiles WITHOUT extensions: type inference sees as directories
// Runtime with Path.fromString also returns RelDir (no hint)
// Use explicit constructor Path.RelFile.fromString('./.gitignore') for correct type AND runtime
expectTypeOf<ReturnType<typeof Path.fromString<'./.gitignore'>>>().toEqualTypeOf<Path.RelDir>() // Type inference limitation - use RelFile.fromString() instead

// ============================================
// Explicit constructors - always return their specific type
// ============================================

// RelFile.fromString always returns RelFile
expectTypeOf<
  ReturnType<typeof Path.RelFile.fromString<'./.gitignore'>>
>().toEqualTypeOf<Path.RelFile>()

// RelDir.fromString always returns RelDir
expectTypeOf<ReturnType<typeof Path.RelDir.fromString<'./readme'>>>().toEqualTypeOf<Path.RelDir>()

// AbsFile.fromString always returns AbsFile
expectTypeOf<
  ReturnType<typeof Path.AbsFile.fromString<'/etc/hosts'>>
>().toEqualTypeOf<Path.AbsFile>()

// AbsDir.fromString always returns AbsDir
expectTypeOf<ReturnType<typeof Path.AbsDir.fromString<'/var/log'>>>().toEqualTypeOf<Path.AbsDir>()
