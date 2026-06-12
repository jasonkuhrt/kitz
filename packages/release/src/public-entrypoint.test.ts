import { defineConfig, Severity } from '@kitz/release'
import { expect, test } from 'bun:test'

test('package root exposes the documented config helpers', () => {
  expect(defineConfig({ trunk: 'release/main' })).toEqual({ trunk: 'release/main' })
  expect(Severity.is('warn')).toBe(true)
  expect(Severity.is('fatal')).toBe(false)
})
