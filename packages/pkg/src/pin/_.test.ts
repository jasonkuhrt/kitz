import { Test } from '@kitz/test'
import * as Pin from './pin.js'

Test.describe('Range')
  .on(Pin.Range.fromString)
  .casesInput(
    '@kitz/core@^1.0.0',
    '@scope/pkg@~2.3.4',
    'lodash@>=4.0.0',
    'express@4.18.0',
    'pkg@*',
  )
  .test()

Test.describe('Tag')
  .on(Pin.Tag.fromString)
  .casesInput(
    'lodash@latest',
    '@kitz/core@next',
    'react@canary',
    'pkg@beta',
  )
  .test()

Test.describe('Workspace')
  .on(Pin.Workspace.fromString)
  .casesInput(
    '@internal/util@workspace:*',
    '@kitz/core@workspace:^',
    'local-pkg@workspace:~',
    '@scope/pkg@workspace:^1.0.0',
  )
  .test()

Test.describe('Git')
  .on(Pin.Git.fromString)
  .casesInput(
    'my-pkg@git+https://github.com/org/repo',
    'my-pkg@git+https://github.com/org/repo#v1.0.0',
    'my-pkg@git+https://github.com/org/repo#semver:^1.0.0',
    'my-pkg@github:user/repo',
  )
  .test()

Test.describe('Path')
  .on(Pin.Path.fromString)
  .casesInput(
    'my-pkg@file:../shared',
    '@local/util@file:./packages/util',
    'pkg@file:/absolute/path',
  )
  .test()

Test.describe('Url')
  .on(Pin.Url.fromString)
  .casesInput(
    'my-pkg@https://example.com/pkg-1.0.0.tgz',
    'custom@http://registry.internal/custom.tar.gz',
  )
  .test()

Test.describe('Alias')
  .on(Pin.Alias.fromString)
  .casesInput(
    'my-lodash@npm:lodash@^4.0.0',
    '@my/react@npm:react@^18.0.0',
    'custom@npm:@scope/pkg@latest',
  )
  .test()

Test.describe('fromString > auto-detection')
  .on(Pin.fromString)
  .casesInput(
    '@kitz/core@^1.0.0',
    'lodash@latest',
    '@internal/util@workspace:*',
    'my-pkg@git+https://github.com/org/repo#v1.0.0',
    'my-pkg@file:../shared',
    'my-pkg@https://example.com/pkg.tgz',
    'my-lodash@npm:lodash@^4.0.0',
  )
  .test()

Test.describe('toString > roundtrip')
  .on((input: string) => Pin.toString(Pin.fromString(input)))
  .casesInput(
    '@kitz/core@^1.0.0',
    'lodash@latest',
    '@internal/util@workspace:*',
    'my-pkg@file:../shared',
  )
  .test()
