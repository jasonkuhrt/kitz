/**
 * Install and manage marker-delimited git hooks.
 *
 * A managed hook owns a single delimited block inside an otherwise hand-editable
 * hook file, so installation is idempotent and never clobbers unrelated hook
 * content. The hooks directory is resolved through the {@link Git} service
 * (honoring `core.hooksPath`), and the file is always written executable.
 *
 * @module
 */
import { Effect, FileSystem, PlatformError } from 'effect'
import { Git, type GitError } from './service.js'

const SHEBANG = '#!/usr/bin/env sh'

const startMarker = (marker: string): string => `# >>> ${marker} >>>`
const endMarker = (marker: string): string => `# <<< ${marker} <<<`

/**
 * Insert or replace the `marker`-delimited managed section in a hook file body.
 *
 * - No existing content → a fresh hook with a shell shebang and the block.
 * - An existing managed section → replaced in place (byte-identical when the
 *   body is unchanged, so the operation is idempotent).
 * - Existing content without the section → the block is appended, preserving
 *   the original hook verbatim.
 */
export const upsertManagedSection = (
  existing: string | null,
  marker: string,
  body: string,
): string => {
  const start = startMarker(marker)
  const end = endMarker(marker)
  const block = `${start}\n${body}\n${end}`

  if (existing === null || existing.trim() === '') {
    return `${SHEBANG}\nset -eu\n\n${block}\n`
  }

  const startIndex = existing.indexOf(start)
  if (startIndex !== -1) {
    // Replace the managed region in place. Search for the end marker *after* the
    // start so reversed or duplicate markers can't mis-pair; a missing end (a
    // hand-corrupted block) means the region runs to EOF — replacing it recovers
    // a clean, idempotent block instead of appending a duplicate.
    const endIndex = existing.indexOf(end, startIndex + start.length)
    const before = existing.slice(0, startIndex)
    const after = endIndex === -1 ? '' : existing.slice(endIndex + end.length)
    return `${before}${block}${after}`
  }

  return `${existing.replace(/\n*$/, '')}\n\n${block}\n`
}

/** Outcome of {@link install}. */
export interface InstallResult {
  /** Absolute path of the hook file. */
  readonly path: string
  /** Whether the file was created, modified, or already current. */
  readonly status: 'created' | 'updated' | 'unchanged'
}

/** Inputs for {@link install}. */
export interface InstallOptions {
  /** Hook file name, e.g. `commit-msg`. */
  readonly hookName: string
  /** Unique marker identifying this feature's managed section. */
  readonly marker: string
  /** Shell line(s) to run inside the managed section. */
  readonly body: string
}

/**
 * Install (or refresh) a managed hook in the repo's resolved hooks directory.
 *
 * Idempotent: re-running with the same body leaves the file byte-identical and
 * reports `unchanged`. The file is always written executable so the repo's
 * own hook-hygiene checks accept it.
 */
export const install = (
  options: InstallOptions,
): Effect.Effect<
  InstallResult,
  GitError | PlatformError.PlatformError,
  Git | FileSystem.FileSystem
> =>
  Effect.gen(function* () {
    const git = yield* Git
    const fs = yield* FileSystem.FileSystem
    const hooksDir = yield* git.getHooksDir()
    const path = `${hooksDir.replace(/\/+$/, '')}/${options.hookName}`

    const existing = (yield* fs.exists(path)) ? yield* fs.readFileString(path) : null
    const next = upsertManagedSection(existing, options.marker, options.body)
    const status: InstallResult['status'] =
      existing === null ? 'created' : existing === next ? 'unchanged' : 'updated'

    yield* fs.makeDirectory(hooksDir, { recursive: true })
    yield* fs.writeFileString(path, next)
    yield* fs.chmod(path, 0o755)

    return { path, status }
  })
