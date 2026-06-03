import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Platform } from '@kitz/platform'
import { Effect } from 'effect'
import { describe, expect, test } from 'bun:test'
import { Git } from './_.js'

const { Hooks } = Git

const MARKER = 'kitz-release commit-msg'
const BODY = 'release git commit validate --message-file "$1"'
const START = `# >>> ${MARKER} >>>`

const countSections = (content: string): number => content.split(START).length - 1

// Run `git` against temp repos with a sanitized env. Inherited GIT_* vars (set
// when these tests run inside a git hook, e.g. pre-commit) would otherwise make
// `git init` target the ambient repo instead of the temp dir. Mirrors the
// allowlist in `_.test.ts`.
const gitEnv: NodeJS.ProcessEnv = {}
for (const key of ['HOME', 'PATH', 'TMPDIR', 'TMP', 'TEMP', 'LANG', 'LC_ALL']) {
  const value = process.env[key]
  if (value !== undefined) gitEnv[key] = value
}

// ─── upsertManagedSection (pure) ────────────────────────────────────

describe('Hooks.upsertManagedSection', () => {
  test('creates a new hook with a shell shebang and a managed block', () => {
    const out = Hooks.upsertManagedSection(null, MARKER, BODY)
    expect(out.startsWith('#!/usr/bin/env sh\n')).toBe(true)
    expect(out).toContain(START)
    expect(out).toContain(BODY)
    expect(out).toContain(`# <<< ${MARKER} <<<`)
  })

  test('is idempotent — re-applying the same body yields byte-identical content', () => {
    const once = Hooks.upsertManagedSection(null, MARKER, BODY)
    const twice = Hooks.upsertManagedSection(once, MARKER, BODY)
    expect(twice).toBe(once)
  })

  test('replaces only the managed block when the body changes', () => {
    const old = Hooks.upsertManagedSection(null, MARKER, 'echo old')
    const updated = Hooks.upsertManagedSection(old, MARKER, 'echo new')
    expect(updated).toContain('echo new')
    expect(updated).not.toContain('echo old')
    expect(countSections(updated)).toBe(1)
  })

  test('preserves an unrelated existing hook and appends the managed block once', () => {
    const existing = '#!/usr/bin/env sh\necho "user hook"\n'
    const out = Hooks.upsertManagedSection(existing, MARKER, BODY)
    expect(out).toContain('echo "user hook"')
    expect(out).toContain(START)
    expect(countSections(out)).toBe(1)
  })

  test('recovers from a corrupted block with a missing end marker (no duplication)', () => {
    const corrupted = `#!/usr/bin/env sh\nset -eu\n\n${START}\necho stale\n` // end marker hand-deleted
    const out = Hooks.upsertManagedSection(corrupted, MARKER, BODY)
    expect(countSections(out)).toBe(1)
    expect(out).toContain(BODY)
    expect(out).not.toContain('echo stale')
    expect(Hooks.upsertManagedSection(out, MARKER, BODY)).toBe(out) // idempotent from recovered state
  })

  test('recovers from reversed markers without duplicating the block', () => {
    const reversed = `#!/usr/bin/env sh\n\n# <<< ${MARKER} <<<\n${START}\n`
    const out = Hooks.upsertManagedSection(reversed, MARKER, BODY)
    expect(countSections(out)).toBe(1)
    expect(out).toContain(BODY)
    expect(Hooks.upsertManagedSection(out, MARKER, BODY)).toBe(out)
  })
})

// ─── getHooksDir (live) ─────────────────────────────────────────────

const initRepo = (): string => {
  const root = mkdtempSync(join(tmpdir(), 'kitz-hooksdir-'))
  execFileSync('git', ['init', '-b', 'main'], { cwd: root, env: gitEnv })
  return root
}

describe('Git.getHooksDir', () => {
  test('Memory returns the configured hooks directory', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const git = yield* Git.Git
        return yield* git.getHooksDir()
      }).pipe(Effect.provide(Git.Memory.make({ hooksDir: '/repo/hooks' }))),
    )
    expect(result).toBe('/repo/hooks')
  })

  test('Live defaults to <gitdir>/hooks for a fresh repo', async () => {
    const root = initRepo()
    try {
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const git = yield* Git.Git
          return yield* git.getHooksDir()
        }).pipe(Effect.provide(Git.makeGitLive(root))),
      )
      expect(result.startsWith('/')).toBe(true)
      expect(result.endsWith(join('.git', 'hooks'))).toBe(true)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('Live honors core.hooksPath', async () => {
    const root = initRepo()
    try {
      execFileSync('git', ['config', 'core.hooksPath', 'my-hooks'], { cwd: root, env: gitEnv })
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const git = yield* Git.Git
          return yield* git.getHooksDir()
        }).pipe(Effect.provide(Git.makeGitLive(root))),
      )
      expect(result.startsWith('/')).toBe(true)
      expect(result.endsWith('my-hooks')).toBe(true)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

// ─── install (real filesystem) ──────────────────────────────────────

const runInstall = (hooksDir: string, body: string) =>
  Effect.runPromise(
    Hooks.install({ hookName: 'commit-msg', marker: MARKER, body }).pipe(
      Effect.provide(Git.Memory.make({ hooksDir })),
      Effect.provide(Platform.FileSystem.layer),
    ),
  )

describe('Hooks.install', () => {
  test('writes an executable commit-msg hook that invokes the body', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'kitz-hooks-'))
    const hooksDir = join(dir, 'hooks')
    try {
      const result = await runInstall(hooksDir, BODY)
      expect(result.status).toBe('created')
      expect(result.path).toBe(join(hooksDir, 'commit-msg'))

      const content = readFileSync(result.path, 'utf8')
      expect(content.startsWith('#!/usr/bin/env sh')).toBe(true)
      expect(content).toContain(BODY)

      // Executable bit set — the repo's pre-commit hook enforces this on hooks/*.
      expect(statSync(result.path).mode & 0o111).not.toBe(0)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('is idempotent: re-running reports unchanged and never duplicates the block', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'kitz-hooks-'))
    const hooksDir = join(dir, 'hooks')
    try {
      const first = await runInstall(hooksDir, BODY)
      const second = await runInstall(hooksDir, BODY)
      expect(first.status).toBe('created')
      expect(second.status).toBe('unchanged')
      expect(countSections(readFileSync(first.path, 'utf8'))).toBe(1)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('preserves a pre-existing unrelated commit-msg hook', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'kitz-hooks-'))
    const hooksDir = join(dir, 'hooks')
    mkdirSync(hooksDir, { recursive: true })
    writeFileSync(join(hooksDir, 'commit-msg'), '#!/usr/bin/env sh\necho keep-me\n')
    try {
      const result = await runInstall(hooksDir, BODY)
      expect(result.status).toBe('updated')
      const content = readFileSync(result.path, 'utf8')
      expect(content).toContain('echo keep-me')
      expect(content).toContain(BODY)
      expect(countSections(content)).toBe(1)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
