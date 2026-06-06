import { ConventionalCommits as CC } from '@kitz/conventional-commits'
import { Layer, Option } from 'effect'
import { PrService } from './services/pr.js'

/** Parameterized PR context layer for PR-rule tests. */
export const makePrLayer = (title: string, commit: CC.Commit.Commit) =>
  Layer.succeed(PrService, {
    number: 129,
    title,
    body: '',
    commit: Option.some(commit),
    titleParseError: Option.none(),
  })
