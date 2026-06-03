import { Option } from 'effect'
import { describe, expect, test } from 'bun:test'
import {
  renderCommandDoc,
  renderReference,
  upsertRegion,
  walkCommandTree,
} from './gen-cli-docs-lib.ts'

describe('renderCommandDoc', () => {
  test('renders heading, description, usage, and a flags table', () => {
    const md = renderCommandDoc(['release', 'git', 'commit', 'validate'], {
      description: 'Validate a commit message file against repo commit policy',
      usage: 'release git commit validate [flags]',
      flags: [
        {
          name: 'message-file',
          aliases: [],
          type: 'string',
          description: Option.some('Path to the commit message file'),
          required: true,
        },
      ],
    })
    expect(md).toContain('#### `release git commit validate`')
    expect(md).toContain('Validate a commit message file against repo commit policy')
    expect(md).toContain('```\nrelease git commit validate [flags]\n```')
    // Flags table has no "Required" column (the doc's flag.required means
    // "takes a value", not "is mandatory" — see toFlagDoc).
    expect(md).toContain('| `--message-file` | `string` | Path to the commit message file |')
  })

  test('omits the flags table when a command has no flags', () => {
    const md = renderCommandDoc(['release', 'git'], {
      description: 'Git integration',
      usage: 'release git <subcommand> [flags]',
      flags: [],
    })
    expect(md).not.toContain('**Flags**')
  })

  test('renders an arguments table and aliases, and escapes pipes', () => {
    const md = renderCommandDoc(['release', 'explain'], {
      description: '',
      usage: 'release explain [pkg]',
      flags: [
        {
          // aliases arrive pre-formatted with dashes (see toFlagDoc)
          name: 'format',
          aliases: ['-f'],
          type: 'text | json',
          description: Option.some('Output format: a | b'),
          required: true,
        },
      ],
      args: [
        {
          name: 'pkg',
          type: 'string',
          description: Option.none(),
          required: false,
          variadic: false,
        },
      ],
    })
    expect(md).toContain('**Arguments**')
    expect(md).toContain('| `pkg` | `string` | no |') // args DO carry a genuine Required column
    // alias rendered verbatim (already dashed), and pipes escaped inside table cells
    expect(md).toContain('`--format`, `-f`')
    expect(md).toContain('text \\| json')
    expect(md).toContain('Output format: a \\| b')
  })
})

describe('upsertRegion', () => {
  const wrap = (body: string): string =>
    `# Title\n\n<!-- CLI_REFERENCE_START -->${body}<!-- CLI_REFERENCE_END -->\n\nfooter\n`

  test('replaces only the content between markers, preserving surroundings', () => {
    const out = upsertRegion(wrap('OLD'), 'CLI_REFERENCE', 'NEW')
    expect(out).toContain('<!-- CLI_REFERENCE_START -->\nNEW\n<!-- CLI_REFERENCE_END -->')
    expect(out).not.toContain('OLD')
    expect(out).toContain('# Title')
    expect(out).toContain('footer')
  })

  test('is idempotent', () => {
    const once = upsertRegion(wrap('OLD'), 'CLI_REFERENCE', 'NEW')
    expect(upsertRegion(once, 'CLI_REFERENCE', 'NEW')).toBe(once)
  })

  test('throws when the markers are missing', () => {
    expect(() => upsertRegion('no markers here', 'CLI_REFERENCE', 'x')).toThrow()
  })
})

describe('walkCommandTree + renderReference (real release tree)', () => {
  test('walks depth-first, root first, with a HelpDoc per node', async () => {
    const { release } = await import('../packages/release/src/cli/tree.ts')
    const entries = walkCommandTree(release)
    const paths = entries.map((e) => e.path.join(' '))
    expect(paths[0]).toBe('release')
    expect(paths).toContain('release git commit validate')
    expect(paths).toContain('release git hooks install')
    expect(entries.every((e) => typeof e.doc.usage === 'string')).toBe(true)
  })

  test('renderReference emits markdown for the whole tree without spawning', async () => {
    const { release } = await import('../packages/release/src/cli/tree.ts')
    const md = renderReference(release)
    expect(md).toContain('#### `release git commit validate`')
    expect(md).toContain('| `--message-file` |')
  })
})
