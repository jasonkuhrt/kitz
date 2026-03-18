import { describe, expect, test } from 'vitest'
import { formatRootHelp, isRootHelpRequest } from './help.js'

describe('release root help', () => {
  test('treats empty args and help flags as help requests', () => {
    expect(isRootHelpRequest([])).toBe(true)
    expect(isRootHelpRequest(['-h'])).toBe(true)
    expect(isRootHelpRequest(['--help'])).toBe(true)
    expect(isRootHelpRequest(['--verbose'])).toBe(false)
  })

  test('renders usage and supported commands', () => {
    const help = formatRootHelp()

    expect(help).toContain('Usage: release <command> [options]')
    expect(help).toContain('doctor [options]')
    expect(help).toContain('forecast [options]')
    expect(help).toContain('notes [pkg] [options]')
    expect(help).toContain('pr <preview|title <suggest|apply>>')
    expect(help).toContain('plan --lifecycle <official|candidate|ephemeral> [options]')
    expect(help).toContain('graph [options]')
    expect(help).toContain('resume [options]')
    expect(help).toContain('status [options]')
    expect(help).toContain('Run `release <command> -h` for command-specific help.')
  })
})
