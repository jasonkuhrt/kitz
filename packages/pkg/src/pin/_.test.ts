import { Test } from '@kitz/test'
import { Semver } from '@kitz/semver'
import { describe, expect, test } from 'vitest'
import * as Pin from './pin.js'

Test.describe('Range')
  .on(Pin.Range.fromString)
  .casesInput('@kitz/core@^1.0.0', '@scope/pkg@~2.3.4', 'lodash@>=4.0.0', 'express@4.18.0', 'pkg@*')
  .test()

Test.describe('Tag')
  .on(Pin.Tag.fromString)
  .casesInput('lodash@latest', '@kitz/core@next', 'react@canary', 'pkg@beta')
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

describe('workspaceSpecifierToPublished', () => {
  test('resolves workspace protocol shortcuts against the package version', () => {
    const version = Semver.fromString('1.2.3')

    expect(Pin.workspaceSpecifierToPublished('@kitz/core', 'workspace:*', version)).toBe('1.2.3')
    expect(Pin.workspaceSpecifierToPublished('@kitz/core', 'workspace:^', version)).toBe('^1.2.3')
    expect(Pin.workspaceSpecifierToPublished('@kitz/core', 'workspace:~', version)).toBe('~1.2.3')
  })

  test('preserves explicit workspace semver ranges', () => {
    const version = Semver.fromString('1.2.3')

    expect(Pin.workspaceSpecifierToPublished('@kitz/core', 'workspace:^1.0.0', version)).toBe(
      '^1.0.0',
    )
  })

  test('rejects non-workspace specifiers', () => {
    expect(() => Pin.workspaceSpecifierToPublished('@kitz/core', '^1.0.0', Semver.zero)).toThrow(
      'Expected workspace protocol dependency',
    )
  })
})

describe('Exact', () => {
  test('parses and renders exact pins', () => {
    const pin = Pin.Exact.fromString('@kitz/core@1.2.3')

    expect(pin.name.moniker).toBe('@kitz/core')
    expect(pin.version.toString()).toBe('1.2.3')
    expect(Pin.toString(pin)).toBe('@kitz/core@1.2.3')
  })

  test('rejects malformed exact pins', () => {
    expect(() => Pin.Exact.fromString('@kitz/core')).toThrow('Invalid exact pin')
    expect(() => Pin.Exact.fromString('@kitz/core@not-a-version')).toThrow('Invalid semver')
  })
})

describe('fromString dispatch and rendering', () => {
  test('renders pins with git refs, semver refs, workspace ranges, and aliases', () => {
    expect(Pin.toString(Pin.Git.fromString('pkg@git+https://github.com/org/repo#main'))).toBe(
      'pkg@git+https://github.com/org/repo#main',
    )
    expect(
      Pin.toString(Pin.Git.fromString('pkg@git+https://github.com/org/repo#semver:^1.0.0')),
    ).toBe('pkg@git+https://github.com/org/repo#semver:>=1.0.0 <2.0.0-0')
    expect(Pin.toString(Pin.Workspace.fromString('@kitz/core@workspace:^1.2.0'))).toBe(
      '@kitz/core@workspace:>=1.2.0 <2.0.0-0',
    )
    expect(Pin.toString(Pin.Alias.fromString('my-react@npm:react@^18.0.0'))).toBe(
      'my-react@npm:react@^18.0.0',
    )
  })

  test('treats digit-leading non-semver specifiers as ranges', () => {
    const pin = Pin.fromString('pkg@1')

    expect(Pin.Range.is(pin)).toBe(true)
    expect(Pin.toString(pin)).toBe('pkg@>=1.0.0 <2.0.0-0')
  })

  test('matches each pin variant exhaustively', () => {
    const describePin = (input: string): string =>
      Pin.match(Pin.fromString(input), {
        PinRange: () => 'range',
        PinExact: () => 'exact',
        PinTag: () => 'tag',
        PinWorkspace: () => 'workspace',
        PinGit: () => 'git',
        PinPath: () => 'path',
        PinUrl: () => 'url',
        PinAlias: () => 'alias',
      })

    expect(
      [
        describePin('@kitz/core@^1.0.0'),
        describePin('@kitz/core@1.0.0'),
        describePin('lodash@latest'),
        describePin('@kitz/core@workspace:*'),
        describePin('pkg@git+https://github.com/org/repo#main'),
        describePin('pkg@file:../shared'),
        describePin('pkg@https://example.com/pkg.tgz'),
        describePin('my-lodash@npm:lodash@^4.0.0'),
      ],
    ).toEqual(['range', 'exact', 'tag', 'workspace', 'git', 'path', 'url', 'alias'])
  })

  test('rejects pins missing a specifier', () => {
    expect(() => Pin.fromString('pkg')).toThrow('Missing specifier')
    expect(() => Pin.fromString('@kitz/core')).toThrow('Missing specifier')
    expect(() => Pin.fromString('@kitz')).toThrow('Invalid scoped package')
  })
})
