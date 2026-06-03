/**
 * Pure rendering + injection logic for the generated CLI reference.
 *
 * The reference is produced entirely in-process from the `effect/unstable/cli`
 * command tree: each command exposes `buildHelpDoc(path)` (structured help
 * data) and `subcommands` (groups of child commands). No `release --help`
 * subprocess is ever spawned.
 */
import { Option } from 'effect'

/** A single flag's structured help, as returned inside a command's HelpDoc. */
export interface FlagDoc {
  readonly name: string
  readonly aliases: readonly string[]
  readonly type: string
  readonly description: Option.Option<string>
  /** Whether the flag takes a value (i.e. is not a boolean switch) — NOT whether it is mandatory. */
  readonly required: boolean
}

/** A single positional argument's structured help. */
export interface ArgDoc {
  readonly name: string
  readonly type: string
  readonly description: Option.Option<string>
  readonly required: boolean
  readonly variadic: boolean
}

/** The subset of a command's `buildHelpDoc(path)` output this generator renders. */
export interface HelpDoc {
  readonly description: string
  readonly usage: string
  readonly flags: readonly FlagDoc[]
  readonly args?: readonly ArgDoc[]
}

/** One command in the tree, with the path that names it and its rendered help. */
export interface Entry {
  readonly path: readonly string[]
  readonly doc: HelpDoc
}

/** Make a string safe to place inside a markdown table cell. */
const cell = (text: string): string =>
  text
    .replace(/\|/g, '\\|')
    .replace(/\r?\n+/g, ' ')
    .trim()

const optCell = (description: Option.Option<string>): string =>
  cell(Option.getOrElse(description, () => ''))

const flagNames = (flag: FlagDoc): string =>
  // aliases already carry their dashes (`-f`, `--foo`); only the primary name is bare.
  [`--${flag.name}`, ...flag.aliases].map((name) => `\`${name}\``).join(', ')

/** Render one command's markdown block (heading, description, usage, tables). */
export const renderCommandDoc = (path: readonly string[], doc: HelpDoc): string => {
  const lines: string[] = [`#### \`${path.join(' ')}\``, '']

  if (doc.description) lines.push(doc.description, '')
  lines.push('```', doc.usage, '```', '')

  if (doc.args && doc.args.length > 0) {
    lines.push(
      '**Arguments**',
      '',
      '| Argument | Type | Required | Description |',
      '| --- | --- | --- | --- |',
    )
    for (const arg of doc.args) {
      const name = arg.variadic ? `${arg.name}...` : arg.name
      lines.push(
        `| \`${name}\` | \`${cell(arg.type)}\` | ${arg.required ? 'yes' : 'no'} | ${optCell(arg.description)} |`,
      )
    }
    lines.push('')
  }

  if (doc.flags.length > 0) {
    lines.push('**Flags**', '', '| Flag | Type | Description |', '| --- | --- | --- |')
    for (const flag of doc.flags) {
      lines.push(`| ${flagNames(flag)} | \`${cell(flag.type)}\` | ${optCell(flag.description)} |`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

const childCommands = (command: any): any[] =>
  (command.subcommands ?? []).flatMap((group: any) => group.commands ?? [])

/**
 * Walk the command tree depth-first (root first), calling `buildHelpDoc(path)`
 * on each node. Purely in-process — reads `subcommands` and `buildHelpDoc` off
 * the live `Command` values.
 */
export const walkCommandTree = (root: any): Entry[] => {
  const entries: Entry[] = []
  const visit = (command: any, parentPath: readonly string[]): void => {
    const path = [...parentPath, command.name]
    entries.push({ path, doc: command.buildHelpDoc(path) as HelpDoc })
    for (const child of childCommands(command)) visit(child, path)
  }
  visit(root, [])
  return entries
}

/** Render the full reference markdown for a command tree. */
export const renderReference = (root: any): string =>
  walkCommandTree(root)
    .map((entry) => renderCommandDoc(entry.path, entry.doc))
    .join('\n')

/**
 * Replace the content between `<!-- {marker}_START -->` and `<!-- {marker}_END -->`
 * with `content`. The marker pair must already exist; the surrounding document
 * is preserved verbatim, so the operation is idempotent for equal `content`.
 */
export const upsertRegion = (text: string, marker: string, content: string): string => {
  const start = `<!-- ${marker}_START -->`
  const end = `<!-- ${marker}_END -->`
  const startIndex = text.indexOf(start)
  const endIndex = text.indexOf(end)
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error(`upsertRegion: markers \`${start}\` / \`${end}\` not found (or out of order)`)
  }
  const before = text.slice(0, startIndex + start.length)
  const after = text.slice(endIndex)
  return `${before}\n${content}\n${after}`
}
