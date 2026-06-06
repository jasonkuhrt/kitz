/**
 * Tag-owned test double for the {@link Git} service.
 *
 * `make(config?)` returns a {@link Test.Mock} driver whose every method is
 * pre-scripted to succeed with happy-path defaults (mirroring
 * {@link Memory.make}). Callers wire it in with `driver.$test.layer()`, inspect
 * calls via `driver.<method>.calls`, and inject failures on any method without
 * re-stubbing the whole interface — e.g. `driver.createTag.everyFail(error)`.
 *
 * @example
 * ```ts
 * import { make as makeGitTest } from '@kitz/git/test'
 * import { Git } from '@kitz/git'
 *
 * const git = makeGitTest({ branch: 'develop' })
 * git.createTag.everyFail(new Git.GitError({ context: { operation: 'createTag' }, cause: new Error('x') }))
 * const layer = git.$test.layer()
 * ```
 *
 * @category Testing
 */

import { Test } from '@kitz/test'
import type { GitPushDryRunResult } from './service.js'
import { Git } from './service.js'
import * as Sha from './sha.js'

/**
 * Happy-path defaults for the Git test double.
 *
 * Mirrors the defaults of {@link Memory.make}: `main` branch, clean tree,
 * `/repo` root, the example remote, and empty tag/commit lists.
 *
 * @category Testing
 */
export interface GitTestConfig {
  /** Tags reported by `getTags` (default `[]`). */
  readonly tags?: ReadonlyArray<string>
  /** Current branch reported by `getCurrentBranch` (default `'main'`). */
  readonly branch?: string
  /** Working-tree clean status reported by `isClean` (default `true`). */
  readonly isClean?: boolean
  /** Repository root reported by `getRoot` (default `'/repo'`). */
  readonly root?: string
  /** Hooks directory reported by `getHooksDir` (default `'<root>/.git/hooks'`). */
  readonly hooksDir?: string
  /** Short HEAD SHA reported by `getHeadSha` (default `'abc1234'`). */
  readonly headSha?: Sha.Sha
  /** Remote URL reported by `getRemoteUrl` (default the example remote). */
  readonly remoteUrl?: string
  /** Dry-run stdout reported by the push dry-run methods (default `'dry-run ok'`). */
  readonly dryRunStdout?: string
}

/**
 * Build a happy-path Git test driver.
 *
 * @category Testing
 */
export const make = (config: GitTestConfig = {}): Test.Mock.Driver<typeof Git> => {
  const root = config.root ?? '/repo'
  const dryRun: GitPushDryRunResult = { stdout: config.dryRunStdout ?? 'dry-run ok' }

  const git = Test.Mock.make(Git)

  git.getTags.everySuccess([...(config.tags ?? [])])
  git.getCurrentBranch.everySuccess(config.branch ?? 'main')
  git.getCommitsSince.everySuccess([])
  git.isClean.everySuccess(config.isClean ?? true)
  git.createTag.everySuccess(undefined)
  git.pushTags.everySuccess(undefined)
  git.pushTagsAtomic.everySuccess(undefined)
  git.pushTagDryRun.everySuccess(dryRun)
  git.pushTagsAtomicDryRun.everySuccess(dryRun)
  git.getRoot.everySuccess(root)
  git.getHooksDir.everySuccess(config.hooksDir ?? `${root}/.git/hooks`)
  git.getHeadSha.everySuccess(config.headSha ?? Sha.make('abc1234'))
  git.getTagSha.everySuccess(config.headSha ?? Sha.make('abc1234'))
  git.isAncestor.everySuccess(true)
  git.createTagAt.everySuccess(undefined)
  git.deleteTag.everySuccess(undefined)
  git.commitExists.everySuccess(true)
  git.pushTag.everySuccess(undefined)
  git.deleteRemoteTag.everySuccess(undefined)
  git.getRemoteUrl.everySuccess(config.remoteUrl ?? 'git@github.com:example/repo.git')

  return git
}
