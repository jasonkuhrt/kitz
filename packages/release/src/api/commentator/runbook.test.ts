import { describe, expect, test } from 'bun:test'
import { buildManualPreviewRunbook } from './runbook.js'

describe('commentator runbook', () => {
  test('builds the ordered manual-preview runbook commands and distTag note', () => {
    const { runbook } = buildManualPreviewRunbook({
      prepareCommands: ['bun run release:build'],
      releaseCommand: 'bun run release',
      prNumber: 42,
      distTag: 'pr-42',
      diffRemote: undefined,
    })

    expect(runbook.title).toBe('Manual Preview Runbook')
    expect(runbook.commands).toEqual([
      'bun run release:build',
      'PR_NUMBER=42 bun run release plan --lifecycle ephemeral',
      'bun run release doctor',
      'bun run release apply --yes',
    ])
    expect(runbook.note).toContain('`pr-42` dist-tag')
  })

  test('threads a non-origin remote into the doctor commands', () => {
    const { runbook, deferredChecks } = buildManualPreviewRunbook({
      prepareCommands: [],
      releaseCommand: 'bun run release',
      prNumber: 7,
      distTag: 'pr-7',
      diffRemote: 'upstream',
    })

    expect(runbook.commands).toEqual([
      'PR_NUMBER=7 bun run release plan --lifecycle ephemeral',
      'bun run release doctor --remote upstream',
      'bun run release apply --yes',
    ])
    expect(deferredChecks.map((entry) => entry.checkCommand)).toEqual([
      'bun run release doctor --remote upstream --onlyRule env.npm-authenticated',
      'bun run release doctor --remote upstream --onlyRule env.git-clean',
      'bun run release doctor --remote upstream --onlyRule env.git-remote',
    ])
  })

  test('emits a deferred check per manual-preview rule with rule metadata', () => {
    const { deferredChecks } = buildManualPreviewRunbook({
      prepareCommands: [],
      releaseCommand: 'bun run release',
      prNumber: 1,
      distTag: 'pr-1',
      diffRemote: undefined,
    })

    expect(deferredChecks.map((entry) => entry.ruleId)).toEqual([
      'env.npm-authenticated',
      'env.git-clean',
      'env.git-remote',
    ])
    expect(deferredChecks[0]?.preventsDescriptions.length).toBeGreaterThan(0)
    expect(deferredChecks[0]?.checkCommand).toBe(
      'bun run release doctor --onlyRule env.npm-authenticated',
    )
  })
})
