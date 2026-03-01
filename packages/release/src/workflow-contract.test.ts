import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '../../..')

const readWorkflow = (name: string): string =>
  readFileSync(path.join(repoRoot, '.github', 'workflows', name), 'utf8')

describe('Release workflow CLI contract', () => {
  test('pr workflow generates release plan with explicit type argument', () => {
    const workflow = readWorkflow('pr.yml')

    expect(workflow).toContain('CLI_PARAMETER_TYPE: pr')
    expect(workflow).toContain('node packages/release/build/cli/cli.js plan --json')
    expect(workflow).toContain('--publish-history /tmp/publish-history.json')
    expect(workflow).not.toContain('CLI_PARAMETER_LIFECYCLE')
  })

  test('publish workflow invokes release plan with explicit type argument', () => {
    const workflow = readWorkflow('publish-pr.yml')

    expect(workflow).toContain('CLI_PARAMETER_TYPE: pr')
    expect(workflow).toContain('node packages/release/build/cli/cli.js plan')
    expect(workflow).not.toContain('CLI_PARAMETER_LIFECYCLE')
  })
})
