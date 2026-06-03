import { Git } from '@kitz/git'
import { Effect } from 'effect'
import { describe, expect, test } from 'bun:test'
import type { CommitOverrides } from '../config.js'
import { resolveConventionalCommitTypes } from '../config.js'
import { resolveOverride } from './commit-override.js'
import { extractImpacts } from './version.js'

const types = resolveConventionalCommitTypes({})

const runImpacts = (commit: Git.Commit, overrides?: CommitOverrides) =>
  Effect.runSync(extractImpacts(commit, types, overrides))

// ─── resolveOverride: SHA-prefix matching ─────────────────────────

describe('resolveOverride', () => {
  const overrides: CommitOverrides = { abc1234: { body: 'reworded' } }

  test('returns undefined when there are no overrides', () => {
    expect(resolveOverride(undefined, 'abc1234')).toBeUndefined()
    expect(resolveOverride({}, 'abc1234')).toBeUndefined()
  })

  test('matches an exact SHA', () => {
    expect(resolveOverride(overrides, 'abc1234')?.body).toBe('reworded')
  })

  test('matches a configured SHA prefix against a longer commit hash', () => {
    expect(resolveOverride(overrides, 'abc1234def5678')?.body).toBe('reworded')
  })

  test('does not match an unrelated hash', () => {
    expect(resolveOverride(overrides, '9999999')).toBeUndefined()
  })
})

// ─── extractImpacts: the changelog-text overlay ───────────────────

describe('extractImpacts — commit-body overlay', () => {
  const featCore = Git.Memory.commit('feat(core): original wording', {
    hash: Git.Sha.make('abc1234def5678'),
  })
  const breakingCore = Git.Memory.commit('feat(core)!: original breaking', {
    hash: Git.Sha.make('beef123'),
  })

  test('rewrites the rendered description for a matching SHA', () => {
    const impacts = runImpacts(featCore, { abc1234def5678: { body: 'corrected wording' } })
    expect(impacts).toHaveLength(1)
    expect(impacts[0]!.commit.forScope('core').description).toBe('corrected wording')
  })

  test('leaves the description untouched without a matching override', () => {
    const impacts = runImpacts(featCore, { '9999999': { body: 'should not apply' } })
    expect(impacts[0]!.commit.forScope('core').description).toBe('original wording')
  })

  test('a body override leaves the scope, type, and bump unchanged', () => {
    const without = runImpacts(featCore)
    const withOverride = runImpacts(featCore, { abc1234def5678: { body: 'corrected wording' } })
    const project = (impacts: ReturnType<typeof runImpacts>) =>
      impacts.map((impact) => ({
        scope: impact.scope,
        bump: impact.bump,
        type: impact.commit.forScope(impact.scope).type.value,
        breaking: impact.commit.forScope(impact.scope).breaking,
      }))
    expect(project(withOverride)).toEqual(project(without))
  })

  test('a non-breaking override body cannot downgrade a breaking commit', () => {
    const impacts = runImpacts(breakingCore, { beef123: { body: 'totally innocuous wording' } })
    expect(impacts[0]!.bump).toBe('major')
    expect(impacts[0]!.commit.forScope('core').breaking).toBe(true)
    expect(impacts[0]!.commit.forScope('core').description).toBe('totally innocuous wording')
  })

  test('matches the override by SHA prefix', () => {
    // commit hash is 'abc1234def5678'; override is keyed by its 7-char prefix.
    const impacts = runImpacts(featCore, { abc1234: { body: 'prefix matched' } })
    expect(impacts[0]!.commit.forScope('core').description).toBe('prefix matched')
  })
})
