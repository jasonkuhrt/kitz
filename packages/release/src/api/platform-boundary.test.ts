import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it as test } from '@effect/vitest'

const apiRoot = decodeURIComponent(new URL('./', import.meta.url).pathname)
const disallowedImportPattern =
  /from ['"](?:@effect\/platform-(?:node|bun|browser)(?:\/[^'"]*)?|@kitz\/platform)['"]/u

const listSharedApiModules = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      return listSharedApiModules(entryPath)
    }

    if (!entry.isFile() || !entry.name.endsWith('.ts')) {
      return []
    }

    if (
      entry.name.endsWith('.test.ts') ||
      entry.name.endsWith('.node.ts') ||
      entry.name.endsWith('.bun.ts')
    ) {
      return []
    }

    return [entryPath]
  })

describe('Release API platform boundary', () => {
  test('shared API modules do not import @effect/platform-node directly', () => {
    const violations = listSharedApiModules(apiRoot)
      .filter((file) => disallowedImportPattern.test(readFileSync(file, 'utf8')))
      .map((file) => path.relative(apiRoot, file))

    expect(violations).toEqual([])
  })
})
