/**
 * Bug-capture regression suite for the path/filesystem audit.
 *
 * Each case uses `test.fails`: the body asserts the CORRECT behavior and currently
 * fails (reproducing the bug), so the test PASSES while the bug exists and FLIPS RED
 * the moment the bug is fixed — then drop `.fails` to leave a normal regression test.
 *
 * These capture SUSPECTED bugs PENDING owner confirmation of intended semantics.
 * (PATH-H1 `up(file)` and PATH-H2 `getRelativeSegments` turned out to be intentional —
 * dropped, JSDoc clarified instead.)
 */
import { expect, test } from '@kitz/vitest'
import { Schema as S } from 'effect'
import { Path } from './_.js'

// FS-H1 — reading a real directory whose name has an extension-like suffix
// (`assets.bak`, `node_modules.old`) throws, because the decode path re-derives
// file-vs-dir from the NAME (analyzer ignores the `directory` hint for dotted names)
// instead of trusting `stat`. PENDING: should the dir hint win here, or should
// `read()` build the loc from `stat`? (Captured at the decode level for now.)
test.fails('[FS-H1] Path.RelDir decodes a dotted directory name', () => {
  const dir = S.decodeSync(Path.RelDir)('assets.bak') as { _tag: string }
  expect(dir._tag).toContain('Dir')
})

// ANL-M1 — the analyzer emits `extension: '.'` for a trailing-dot filename (`foo.`),
// which the Extension schema then rejects, so `RelFile.fromString('./foo.')` throws
// instead of decoding `{ stem: 'foo.', extension: null }`. (Analyzer disagrees with
// its own downstream schema — PENDING confirmation that `foo.` should be valid.)
test.fails('[ANL-M1] a trailing-dot filename decodes without a spurious "." extension', () => {
  const file = Path.RelFile.fromString('./foo.')
  expect(file.toString()).toBe('./foo.')
})
