import { describe, expect, test } from 'vitest'
import { formatHelp, parseAction } from './pr-lib.js'

describe('release pr command helpers', () => {
  test('parses preview flags in any supported order and normalizes explicit remotes', () => {
    expect(parseAction(['preview', '--check-only', '--remote', ' fork '])).toEqual({
      _tag: 'preview',
      checkOnly: true,
      remote: 'fork',
    })
  })

  test('rejects preview remote overrides without a usable value', () => {
    expect(parseAction(['preview', '--remote'])).toBeNull()
    expect(parseAction(['preview', '--remote', '   '])).toBeNull()
    expect(parseAction(['preview', '--remote', '--check-only'])).toBeNull()
  })

  test('parses title actions and rejects unknown commands', () => {
    expect(parseAction(['title', 'suggest'])).toEqual({ _tag: 'title', action: 'suggest' })
    expect(parseAction(['title', 'apply'])).toEqual({ _tag: 'title', action: 'apply' })
    expect(parseAction(['preview', '--unknown'])).toBeNull()
    expect(parseAction(['title', 'preview'])).toBeNull()
  })

  test('documents the remote override in command help', () => {
    expect(formatHelp()).toContain('Pass `--remote <name>` to override the PR diff remote')
  })
})
