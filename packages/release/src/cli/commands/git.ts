/**
 * @module cli/commands/git
 *
 * Git integration for `@kitz/release`.
 *
 * `release git commit validate --message-file <path>` validates a commit
 * message against the repo's commit policy and exits non-zero on failure — the
 * surface a `commit-msg` hook calls.
 *
 * `release git hooks install` installs that hook idempotently under the repo's
 * resolved hooks directory.
 *
 * Both leaves are thin glue over bounded primitives: parsing/policy lives in
 * `@kitz/conventional-commits` + {@link Api.CommitPolicy}, and hook/message
 * mechanics live in `@kitz/git`.
 */
import { Env } from '@kitz/env'
import { Git } from '@kitz/git'
import { Console, Effect, FileSystem, Layer } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import * as Api from '../../api/__.js'
import { FileSystemLayer } from '../../platform.js'
import {
  COMMIT_MSG_BODY,
  COMMIT_MSG_MARKER,
  renderInstallResult,
  validateCommitMessage,
} from './git-lib.js'

const gitCommitValidate = Command.make(
  'validate',
  {
    messageFile: Flag.string('message-file').pipe(
      Flag.withDescription(
        "Path to the commit message file to validate (the commit-msg hook's $1)",
      ),
    ),
  },
  ({ messageFile }) =>
    Effect.gen(function* () {
      const env = yield* Env.Env
      const fs = yield* FileSystem.FileSystem

      if (!(yield* fs.exists(messageFile))) {
        yield* Console.error(`Commit message file not found: ${messageFile}`)
        return env.exit(1)
      }

      const config = yield* Api.Config.load()
      const raw = yield* fs.readFileString(messageFile)
      const outcome = validateCommitMessage(raw, config.resolvedConventionalCommitTypes)

      if (outcome.ok) return
      yield* Console.error(outcome.lines.join('\n'))
      return env.exit(1)
    }),
).pipe(Command.withDescription('Validate a commit message file against repo commit policy'))

const gitCommit = Command.make('commit').pipe(
  Command.withDescription('Commit-message policy commands'),
  Command.withSubcommands([gitCommitValidate]),
)

const gitHooksInstall = Command.make('install', {}, () =>
  Effect.gen(function* () {
    const result = yield* Git.Hooks.install({
      hookName: 'commit-msg',
      marker: COMMIT_MSG_MARKER,
      body: COMMIT_MSG_BODY,
    })
    yield* Console.log(renderInstallResult(result))
  }),
).pipe(Command.withDescription('Install the idempotent commit-msg hook that runs the validator'))

const gitHooks = Command.make('hooks').pipe(
  Command.withDescription('Manage the kitz-release git hooks'),
  Command.withSubcommands([gitHooksInstall]),
)

export const git = Command.make('git').pipe(
  Command.withDescription('Git integration: commit-message validation and hook installation'),
  Command.withSubcommands([gitCommit, gitHooks]),
  Command.provide(Layer.mergeAll(Env.Live, FileSystemLayer, Git.GitLive)),
)
