import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '../../..')

const readWorkflow = (name: string): string =>
  readFileSync(path.join(repoRoot, '.github', 'workflows', name), 'utf8')

describe('Release workflow CLI contract', () => {
  test('pr workflow renders a forecast comment through npm scripts', () => {
    const workflow = readWorkflow('pr.yml')

    expect(workflow).toContain('bun run release:build')
    expect(workflow).toContain(
      'bun run release:forecast:comment -- --publish-history /tmp/publish-history.json > /tmp/release-plan-comment.md',
    )
    expect(workflow).toContain('PR_TITLE: ${{ github.event.pull_request.title }}')
    expect(workflow).toContain('PR_BODY: ${{ github.event.pull_request.body }}')
    expect(workflow).not.toContain('CLI_PARAMETER_TYPE')
    expect(workflow).not.toContain('just ')
    expect(workflow).not.toContain('node packages/release/build/cli/cli.js render')
    expect(workflow).not.toContain('node packages/release/build/cli/cli.js plan --json')
  })

  test('repo no longer ships automated publish workflows', () => {
    expect(existsSync(path.join(repoRoot, '.github', 'workflows', 'publish-pr.yml'))).toBe(false)
    expect(existsSync(path.join(repoRoot, '.github', 'workflows', 'trunk.yml'))).toBe(false)
  })
})
