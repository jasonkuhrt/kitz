import { describe, expect, it } from '@effect/vitest'
import { analyze } from './analyzer.js'

describe('hint option', () => {
  // Without hint: dotfiles without extensions default to directory
  it("analyze('./.gitignore')", () => {
    expect(analyze('./.gitignore')).toMatchSnapshot()
  })
  it("analyze('./.env')", () => {
    expect(analyze('./.env')).toMatchSnapshot()
  })
  it("analyze('./readme')", () => {
    expect(analyze('./readme')).toMatchSnapshot()
  })
  it("analyze('/etc/hosts')", () => {
    expect(analyze('/etc/hosts')).toMatchSnapshot()
  })

  // With file hint: dotfiles treated as files
  it("analyze('./.gitignore', { hint: 'file' })", () => {
    expect(analyze('./.gitignore', { hint: 'file' })).toMatchSnapshot()
  })
  it("analyze('./.env', { hint: 'file' })", () => {
    expect(analyze('./.env', { hint: 'file' })).toMatchSnapshot()
  })
  it("analyze('./readme', { hint: 'file' })", () => {
    expect(analyze('./readme', { hint: 'file' })).toMatchSnapshot()
  })
  it("analyze('/etc/hosts', { hint: 'file' })", () => {
    expect(analyze('/etc/hosts', { hint: 'file' })).toMatchSnapshot()
  })

  // With directory hint: same as default for ambiguous
  it("analyze('./.gitignore', { hint: 'directory' })", () => {
    expect(analyze('./.gitignore', { hint: 'directory' })).toMatchSnapshot()
  })

  // Clear extensions always file (hint doesn't matter)
  it("analyze('./config.json')", () => {
    expect(analyze('./config.json')).toMatchSnapshot()
  })
  it("analyze('./config.json', { hint: 'directory' })", () => {
    expect(analyze('./config.json', { hint: 'directory' })).toMatchSnapshot()
  })
  it("analyze('./.env.local')", () => {
    expect(analyze('./.env.local')).toMatchSnapshot()
  })

  // Trailing slash always directory (hint doesn't matter)
  it("analyze('./src/')", () => {
    expect(analyze('./src/')).toMatchSnapshot()
  })
  it("analyze('./src/', { hint: 'file' })", () => {
    expect(analyze('./src/', { hint: 'file' })).toMatchSnapshot()
  })
})
