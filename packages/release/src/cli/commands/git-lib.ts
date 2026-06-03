/**
 * @module cli/commands/git-lib
 *
 * Pure, testable logic behind the `release git` commands. The `git.ts` command
 * tree stays thin glue (read the message file, exit with a code); the policy
 * decision and the human-facing rendering live here.
 */
import { Git } from '@kitz/git'
import { Match } from 'effect'
import * as CommitPolicy from '../../api/commit-policy.js'

/** Marker delimiting the managed section this feature owns in `commit-msg`. */
export const COMMIT_MSG_MARKER = 'kitz-release commit-msg'

/** The line the managed `commit-msg` hook runs. `$1` is git's message-file path. */
export const COMMIT_MSG_BODY = 'release git commit validate --message-file "$1"'

const renderProblem = (problem: CommitPolicy.Problem): readonly string[] =>
  Match.value(problem).pipe(
    Match.tagsExhaustive({
      InvalidTitle: (p) => [
        'Invalid commit message — the subject is not a conventional-commit title:',
        `  ${p.input}`,
        `  Reason: ${p.reason}`,
        '  Expected: <type>(<scope>): <subject>   e.g. "feat(core): add thing"',
      ],
      UnknownTypes: (p) => [
        `Unrecognized commit type(s): ${p.types.map((type) => `"${type}"`).join(', ')}`,
        '  Use a standard type (feat, fix, docs, …) or declare it under',
        '  conventionalCommitSettings.types in release.config.ts.',
      ],
    }),
  )

/** Outcome of validating a raw commit message: pass/fail plus diagnostic lines. */
export interface ValidateOutcome {
  /** True when the message satisfies the policy (no diagnostics). */
  readonly ok: boolean
  /** Deterministic, hook-friendly diagnostic lines (empty when `ok`). */
  readonly lines: readonly string[]
}

/**
 * Validate a raw commit message (subject + body) against the resolved type
 * policy. Composes the subject extractor and the commit policy, then renders
 * any problems — the single decision point shared with the lint rules lives in
 * {@link CommitPolicy}.
 */
export const validateCommitMessage = (
  raw: string,
  resolvedTypes: Readonly<Record<string, unknown>>,
): ValidateOutcome => {
  const subject = Git.CommitMessage.subject(raw)
  if (subject === null) {
    return { ok: false, lines: ['Invalid commit message — it has no subject line.'] }
  }
  const problems = CommitPolicy.validateTitle(subject, resolvedTypes)
  if (problems.length === 0) return { ok: true, lines: [] }
  return { ok: false, lines: problems.flatMap(renderProblem) }
}

const installMessage = {
  created: 'Installed commit-msg hook',
  updated: 'Updated commit-msg hook',
  unchanged: 'commit-msg hook already up to date',
} as const satisfies Record<Git.Hooks.InstallResult['status'], string>

/** Render the hook-install outcome as a single status line. */
export const renderInstallResult = (result: Git.Hooks.InstallResult): string =>
  `${installMessage[result.status]} → ${result.path}`
