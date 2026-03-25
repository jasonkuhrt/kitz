import { describe, expect, test } from 'vitest'
import * as KitzModule from './_.js'
import * as PublicEntry from './__.js'
import * as RootEntry from './index.js'

const subpathImports = [
  './arr.js',
  './assert.js',
  './bldr.js',
  './bool.js',
  './cli.js',
  './color.js',
  './conf.js',
  './date.js',
  './env.js',
  './err.js',
  './fn.js',
  './fs.js',
  './group.js',
  './html.js',
  './http.js',
  './idx.js',
  './json.js',
  './jsonc.js',
  './lang.js',
  './log.js',
  './mod.js',
  './monorepo.js',
  './name.js',
  './null.js',
  './num.js',
  './oak.js',
  './obj.js',
  './optic.js',
  './paka.js',
  './pat.js',
  './pkg.js',
  './platform.js',
  './prom.js',
  './prox.js',
  './rec.js',
  './resource.js',
  './sch.js',
  './semver.js',
  './str.js',
  './syn.js',
  './test.js',
  './tex.js',
  './tree.js',
  './ts.js',
  './tup.js',
  './undefined.js',
  './url.js',
  './ware.js',
  './yaml.js',
] as const

describe('kitz', () => {
  test('exports the Kitz namespace and root entrypoint', () => {
    expect(KitzModule.Kitz).toBeDefined()
    expect(PublicEntry.Assert).toBe(RootEntry.Assert)
    expect(RootEntry.Arr).toBeDefined()
    expect(RootEntry.Html.escape('<kitz>')).toBe('&lt;kitz&gt;')
    expect(RootEntry.ExtNum).toBeDefined()
  })

  test('imports every published subpath entrypoint', async () => {
    const modules = await Promise.all(subpathImports.map((path) => import(path)))

    expect(modules).toHaveLength(subpathImports.length)
    for (const module of modules) {
      expect(module).toBeTypeOf('object')
    }
  })
})
