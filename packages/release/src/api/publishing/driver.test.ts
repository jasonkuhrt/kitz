import { Test } from '@kitz/test'
import { expect, test } from 'bun:test'
import { agentFromProjectManager, PackageManagerCommand } from './driver.js'

Test.on(agentFromProjectManager)
  .cases(
    [['npm'], 'npm'],
    [['pnpm'], 'pnpm'],
    [['bun'], 'bun'],
    [['yarn'], 'npm'],
    [['unknown'], 'npm'],
  )
  .test()

test('PackageManagerCommand stays the package-manager command schema', () => {
  const command = PackageManagerCommand.decodeSync(
    PackageManagerCommand.encodeSync(
      PackageManagerCommand.fromParts('pnpm', ['publish', '--dry-run']),
    ),
  )

  expect(command.argv).toEqual(['pnpm', 'publish', '--dry-run'])
})
