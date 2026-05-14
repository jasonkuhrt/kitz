import { describe, expect, test } from 'bun:test'
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
    expect(help).toContain('archive export [options]')
    expect(help).toContain('conformance run [options]')
    expect(help).toContain('doctor [options]')
    expect(help).toContain('explain [pkg] [options]')
    expect(help).toContain('forecast [options]')
    expect(help).toContain('history [options]')
    expect(help).toContain('inspect <package>@<version>')
    expect(help).toContain('matrix verify [options]')
    expect(help).toContain('notes [pkg] [options]')
    expect(help).toContain('pr <preview|title <suggest|apply>>')
    expect(help).toContain('plan [options]')
    expect(help).toContain('preview [options]')
    expect(help).toContain('prove [options]')
    expect(help).toContain('reconcile [options]')
    expect(help).toContain('rehearse [options]')
    expect(help).toContain('graph [options]')
    expect(help).toContain('prune [options]')
    expect(help).toContain('resume [options]')
    expect(help).toContain('status [options]')
    expect(help).toContain('ui')
    expect(help).toContain('validate-setup [options]')
    expect(help).toContain('Run `release <command> -h` for command-specific help.')
  })
})
