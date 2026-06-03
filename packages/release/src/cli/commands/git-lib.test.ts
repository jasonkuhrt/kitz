import { Git } from '@kitz/git'
import { describe, expect, test } from 'bun:test'
import { resolveConventionalCommitTypes } from '../../api/config.js'
import { renderInstallResult, validateCommitMessage } from './git-lib.js'

// Standard defaults plus the repo's dotted docs-chore convention.
const resolved = resolveConventionalCommitTypes({ 'chore.docs': null })

describe('validateCommitMessage', () => {
  test('accepts a standard scoped title with no diagnostics', () => {
    expect(validateCommitMessage('feat(core): add thing', resolved)).toEqual({
      ok: true,
      lines: [],
    })
  })

  test('accepts multi-scope, docs, and chore.docs titles', () => {
    expect(validateCommitMessage('fix(core, release): tighten narrowing', resolved).ok).toBe(true)
    expect(validateCommitMessage('docs: clarify rationale', resolved).ok).toBe(true)
    expect(validateCommitMessage('chore.docs: reconcile skills table', resolved).ok).toBe(true)
  })

  test('extracts the subject from a full message with a body and comments', () => {
    const raw = 'feat(core): add thing\n\nA body paragraph.\n\n# git template comment'
    expect(validateCommitMessage(raw, resolved).ok).toBe(true)
  })

  test('rejects an invalid title, echoing the offending subject', () => {
    const outcome = validateCommitMessage('just some prose', resolved)
    expect(outcome.ok).toBe(false)
    expect(outcome.lines.join('\n')).toContain('just some prose')
  })

  test('rejects an unrecognized type and names it', () => {
    const outcome = validateCommitMessage('wip(core): experiment', resolved)
    expect(outcome.ok).toBe(false)
    expect(outcome.lines.join('\n')).toContain('wip')
  })

  test('rejects a message with no subject line', () => {
    const outcome = validateCommitMessage('   \n# only a comment\n', resolved)
    expect(outcome.ok).toBe(false)
    expect(outcome.lines.length).toBeGreaterThan(0)
  })
})

describe('renderInstallResult', () => {
  const path = '/repo/hooks/commit-msg'

  test('reports a created hook with its path', () => {
    const line = renderInstallResult({ path, status: 'created' })
    expect(line).toContain(path)
    expect(line.toLowerCase()).toContain('install')
  })

  test('reports an updated hook', () => {
    expect(renderInstallResult({ path, status: 'updated' }).toLowerCase()).toContain('updat')
  })

  test('reports an unchanged hook as already up to date', () => {
    expect(renderInstallResult({ path, status: 'unchanged' }).toLowerCase()).toContain('up to date')
  })
})
