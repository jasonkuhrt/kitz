/**
 * Bug-capture regression suite for the 2026-06-23 audit (see
 * `packages/effect/docs/review-2026-06-23.md`).
 *
 * Each case uses `test.fails`: the body asserts the CORRECT behavior and currently
 * fails (reproducing the bug), so the test PASSES while the bug exists and FLIPS RED
 * the moment the bug is fixed. When that happens, drop the `.fails` (and any bug note)
 * to convert it into a normal regression test.
 *
 * Runtime bugs only; type-level divergences are captured in
 * `audit-regressions.test-d.ts`. Bugs that can't be safely reproduced here
 * (FS-H4 symlink-cycle hang) or that depend on an undecided contract (BLD-H1,
 * PATH-H1/H2 return-kind) are noted in the review doc.
 */
import { expect, test } from '@kitz/vitest'
import { Schema as S } from 'effect'
import { Path } from './path/_.js'

// PATH-H1 — `up()` of a file must return its containing DIRECTORY, not a file
// relocated into the grandparent. Currently up('/workspace/pkg/index.ts') →
// '/workspace/index.ts' (segment sliced, filename kept).
test.fails('[PATH-H1] up(file) returns the containing directory', () => {
  const parent = Path.up(Path.AbsFile.fromString('/workspace/pkg/index.ts'))
  expect(parent.toString()).toBe('/workspace/pkg/')
})

// PATH-H2 — a relative path FROM a base TO a file child must include the filename.
// Currently getRelativeSegments drops it (a file's `.segments` exclude the filename).
test.fails('[PATH-H2] getRelativeSegments to a file includes the filename', () => {
  const child = Path.AbsFile.fromString('/workspace/pkg/index.ts')
  const base = Path.AbsDir.fromString('/workspace/')
  expect(Path.getRelativeSegments(child, base)).toContain('index.ts')
})

// FS-H1 — the `directory` hint must win: `Path.RelDir` should decode a dotted
// directory name (e.g. `assets.bak`, `node_modules.old`). The analyzer ignores the
// hint for names with an extension, so this throws — which makes `read()` reject any
// directory containing such a subdirectory.
test.fails('[FS-H1] Path.RelDir decodes a dotted directory name', () => {
  const dir = S.decodeSync(Path.RelDir)('assets.bak') as { _tag: string }
  expect(dir._tag).toContain('Dir')
})

// ANL-M1 — a trailing-dot filename (`foo.`) must not yield an extension of `.`
// (which the Extension schema then rejects). Currently RelFile.fromString('./foo.')
// throws instead of decoding `{ stem: 'foo.', extension: null }`.
test.fails('[ANL-M1] a trailing-dot filename decodes without a spurious "." extension', () => {
  const file = Path.RelFile.fromString('./foo.')
  expect(file.toString()).toBe('./foo.')
})
