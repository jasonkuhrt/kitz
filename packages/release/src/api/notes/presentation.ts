import { Option } from 'effect'
import type { PackageNotes } from './generate.js'

export interface JsonPackageNotes {
  readonly package: string
  readonly currentVersion: string | null
  readonly nextVersion: string
  readonly bump: string
  readonly notes: string
  readonly hasBreakingChanges: boolean
}

export const toJsonNotes = (notes: readonly PackageNotes[]): readonly JsonPackageNotes[] =>
  notes.map((note) => ({
    package: note.package.name.moniker,
    currentVersion: Option.isSome(note.currentVersion) ? note.currentVersion.value.toString() : null,
    nextVersion: note.nextVersion.toString(),
    bump: note.bump,
    notes: note.notes.markdown,
    hasBreakingChanges: note.notes.hasBreakingChanges,
  }))

export const renderMarkdownNotes = (notes: readonly PackageNotes[]): string =>
  notes.map((note) => note.notes.markdown).join('\n\n')
