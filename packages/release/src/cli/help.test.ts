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
    expect(help).toContain('plan <stable|preview|pr> [options]')
    expect(help).toContain('status [pkg...]')
    expect(help).toContain('Run `release <command> -h` for command-specific help.')
  })
})
