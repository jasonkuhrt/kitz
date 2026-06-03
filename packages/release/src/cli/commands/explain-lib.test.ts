import { Fs } from '@kitz/fs'
import { Pkg } from '@kitz/pkg'
import { describe, expect, test } from 'bun:test'
import type { Package } from '../../api/analyzer/workspace.js'
import { createPackagePickerOptions } from './explain-lib.js'

const packages: readonly Package[] = [
  {
    scope: 'zeta',
    name: Pkg.Moniker.parse('@kitz/zeta'),
    path: Fs.Path.AbsDir.fromString('/repo/packages/zeta/'),
  },
  {
    scope: 'alpha',
    name: Pkg.Moniker.parse('@kitz/alpha'),
    path: Fs.Path.AbsDir.fromString('/repo/packages/alpha/'),
  },
  {
    scope: 'core',
    name: Pkg.Moniker.parse('@kitz/core'),
    path: Fs.Path.AbsDir.fromString('/repo/packages/core/'),
  },
]

describe('explain command package selection', () => {
  test('builds alphabetized picker options from workspace packages', () => {
    expect(createPackagePickerOptions(packages)).toEqual([
      {
        label: 'alpha',
        value: '@kitz/alpha',
        detail: '@kitz/alpha',
      },
      {
        label: 'core',
        value: '@kitz/core',
        detail: '@kitz/core',
      },
      {
        label: 'zeta',
        value: '@kitz/zeta',
        detail: '@kitz/zeta',
      },
    ])
  })
})
