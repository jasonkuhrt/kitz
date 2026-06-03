#!/usr/bin/env bun
/**
 * Generate the CLI reference for `@kitz/release` into its README.
 *
 * Walks the `release` command tree entirely in-process (each command's
 * `buildHelpDoc(path)` + `subcommands`) and writes markdown into the
 * `CLI_REFERENCE` managed region. No `release --help` subprocess is spawned.
 *
 * Usage:
 *   bun tools/gen-cli-docs.ts            # rewrite the region in place
 *   bun tools/gen-cli-docs.ts --check    # fail (exit 1) if the region is stale
 */
// oxlint-disable-next-line kitz/module/no-nodejs-builtins
import { readFileSync, writeFileSync } from 'node:fs'
// oxlint-disable-next-line kitz/module/no-nodejs-builtins
import { join } from 'node:path'
import { release } from '../packages/release/src/cli/tree.ts'
import { renderReference, upsertRegion } from './gen-cli-docs-lib.ts'

const README = join(import.meta.dir, '..', 'packages', 'release', 'README.md')
const MARKER = 'CLI_REFERENCE'

const current = readFileSync(README, 'utf8')
// Pad with blank lines so the markdown renders inside the <details> block on
// GitHub (block-level markdown after the START comment needs a blank line).
const next = upsertRegion(current, MARKER, `\n${renderReference(release)}`)
const check = process.argv.includes('--check')

if (next === current) {
  console.log('CLI reference is up to date.')
} else if (check) {
  console.error('CLI reference is out of date. Run `bun run gen:cli-docs` and commit the result.')
  process.exit(1)
} else {
  writeFileSync(README, next)
  console.log(`CLI reference regenerated → ${README}`)
}
