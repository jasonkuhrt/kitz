import { Schema } from 'effect'
import { describe, expect, test } from 'vitest'
import * as ViolationLocation from './violation-location.js'
import { CommandFix, DocLink, FixStep, GuideFix, Hint, Violation } from './violation.js'

describe('Violation', () => {
  test('make with PrTitle location', () => {
    const v = new Violation({
      location: new ViolationLocation.PrTitle({ title: 'bad title' }),
    })
    expect(v._tag).toBe('Violation')
    expect(Violation.is(v)).toBe(true)
    expect(v.location._tag).toBe('ViolationLocationPrTitle')
  })

  test('make with Environment location', () => {
    const v = new Violation({
      location: new ViolationLocation.Environment({ message: 'not authenticated' }),
    })
    expect(v.location._tag).toBe('ViolationLocationEnvironment')
  })

  test('schema roundtrip', () => {
    const v = new Violation({
      location: new ViolationLocation.GitHistory({ sha: 'abc1234' }),
      summary: 'History is not monotonic',
      fix: new GuideFix({
        summary: 'Rebase the branch and rerun doctor.',
        steps: [new FixStep({ description: 'Rebase onto trunk.' })],
      }),
      hints: [new Hint({ description: 'Rebase onto trunk before retrying.' })],
      docs: [new DocLink({ label: 'Release docs', url: 'https://example.com/release' })],
    })
    const encoded = Schema.encodeSync(Violation)(v)
    const decoded = Schema.decodeSync(Violation)(encoded)
    expect(decoded._tag).toBe('Violation')
    expect(decoded.location._tag).toBe('ViolationLocationGitHistory')
    expect(decoded.summary).toBe('History is not monotonic')
    expect(decoded.fix?._tag).toBe('ViolationGuideFix')
    expect(decoded.hints).toHaveLength(1)
    expect(decoded.docs).toHaveLength(1)
  })
})

describe('FixStep', () => {
  test('make and is()', () => {
    const step = new FixStep({ description: 'Run npm login' })
    expect(step._tag).toBe('ViolationFixStep')
    expect(FixStep.is(step)).toBe(true)
    expect(step.description).toBe('Run npm login')
  })
})

describe('GuideFix', () => {
  test('make and is()', () => {
    const fix = new GuideFix({
      summary: 'Sign in locally.',
      steps: [new FixStep({ description: 'Run npm login' })],
    })
    expect(fix._tag).toBe('ViolationGuideFix')
    expect(GuideFix.is(fix)).toBe(true)
  })
})

describe('CommandFix', () => {
  test('make and is()', () => {
    const fix = new CommandFix({
      summary: 'Apply the canonical PR title header.',
      command: 'release pr title apply',
    })
    expect(fix._tag).toBe('ViolationCommandFix')
    expect(CommandFix.is(fix)).toBe(true)
  })
})

describe('Hint', () => {
  test('make and is()', () => {
    const h = new Hint({ description: 'Try running npm login' })
    expect(h._tag).toBe('Hint')
    expect(Hint.is(h)).toBe(true)
    expect(h.description).toBe('Try running npm login')
  })

  test('schema roundtrip', () => {
    const h = new Hint({ description: 'Consider adding a scope' })
    const encoded = Schema.encodeSync(Hint)(h)
    const decoded = Schema.decodeSync(Hint)(encoded)
    expect(decoded.description).toBe('Consider adding a scope')
  })
})

describe('DocLink', () => {
  test('make and is()', () => {
    const doc = new DocLink({ label: 'npm docs', url: 'https://docs.npmjs.com/' })
    expect(doc._tag).toBe('ViolationDocLink')
    expect(DocLink.is(doc)).toBe(true)
  })
})

describe('ViolationLocation variants', () => {
  test('PrTitle', () => {
    const loc = new ViolationLocation.PrTitle({ title: 'fix: something' })
    expect(loc._tag).toBe('ViolationLocationPrTitle')
    expect(ViolationLocation.PrTitle.is(loc)).toBe(true)
  })

  test('PrBody', () => {
    const loc = new ViolationLocation.PrBody({})
    expect(loc._tag).toBe('ViolationLocationPrBody')
  })

  test('PrBody with line', () => {
    const loc = new ViolationLocation.PrBody({ line: 42 })
    expect(loc.line).toBe(42)
  })

  test('RepoSettings', () => {
    const loc = new ViolationLocation.RepoSettings({})
    expect(loc._tag).toBe('ViolationLocationRepoSettings')
  })

  test('GitHistory', () => {
    const loc = new ViolationLocation.GitHistory({ sha: 'abc1234' })
    expect(loc._tag).toBe('ViolationLocationGitHistory')
    expect(loc.sha).toBe('abc1234')
  })

  test('File', () => {
    const loc = new ViolationLocation.File({ path: 'src/index.ts', line: 10 })
    expect(loc._tag).toBe('ViolationLocationFile')
    expect(loc.path).toBe('src/index.ts')
    expect(loc.line).toBe(10)
  })

  test('Environment', () => {
    const loc = new ViolationLocation.Environment({ message: 'npm not authenticated' })
    expect(loc._tag).toBe('ViolationLocationEnvironment')
    expect(loc.message).toBe('npm not authenticated')
  })

  test('ViolationLocation union schema roundtrip', () => {
    const loc = new ViolationLocation.File({ path: 'test.ts' })
    const encoded = Schema.encodeSync(ViolationLocation.ViolationLocation)(loc)
    const decoded = Schema.decodeSync(ViolationLocation.ViolationLocation)(encoded)
    expect(decoded._tag).toBe('ViolationLocationFile')
  })
})
