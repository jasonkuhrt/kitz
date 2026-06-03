import { Test } from '@kitz/test'
import { expect, test } from 'bun:test'
import { Git } from './_.js'

const { CommitMessage } = Git

// oxfmt-ignore
Test.describe('CommitMessage.subject')
  .on(CommitMessage.subject)
  .cases(
    [['feat: add thing'],                       'feat: add thing'],
    [['feat(core): add\n\nbody paragraph'],     'feat(core): add'],  // first line, body ignored
    [['# leading comment\nfeat: add thing'],    'feat: add thing'],  // skip git comment lines
    [['\n\nfeat: add thing'],                    'feat: add thing'],  // skip blank lines
    [['   feat: add thing   '],                  'feat: add thing'],  // trim
  )
  .test()

test('CommitMessage.subject > returns null when no subject exists', () => {
  expect(CommitMessage.subject('')).toBeNull()
  expect(CommitMessage.subject('# only a comment\n# another comment\n')).toBeNull()
})
