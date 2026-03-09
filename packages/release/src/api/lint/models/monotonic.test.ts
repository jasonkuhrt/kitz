import { describe, expect, test } from 'vitest'
import type {
  AuditResult,
  AuditViolation,
  MonotonicViolation,
  TagInfo,
  ValidationResult,
} from './monotonic.js'

/**
 * These are interface-only types, so we verify structural compatibility.
 * (No runtime classes to instantiate - just shape validation.)
 */

describe('monotonic model types', () => {
  test('TagInfo shape', () => {
    const tag: TagInfo = {
      tag: '@kitz/core@1.0.0',
      version: { major: 1, minor: 0, patch: 0, _tag: 'Semver' } as any,
      sha: 'abc1234' as any,
    }
    expect(tag.tag).toBe('@kitz/core@1.0.0')
  })

  test('MonotonicViolation shape', () => {
    const v: MonotonicViolation = {
      existingVersion: { major: 1, minor: 0, patch: 0, _tag: 'Semver' } as any,
      existingSha: 'def5678' as any,
      relationship: 'ancestor',
      message: 'Version 1.0.0 is an ancestor',
    }
    expect(v.relationship).toBe('ancestor')
    expect(v.message).toContain('ancestor')
  })

  test('MonotonicViolation descendant relationship', () => {
    const v: MonotonicViolation = {
      existingVersion: { major: 2, minor: 0, patch: 0, _tag: 'Semver' } as any,
      existingSha: 'ghi9012' as any,
      relationship: 'descendant',
      message: 'Version 2.0.0 is a descendant',
    }
    expect(v.relationship).toBe('descendant')
  })

  test('ValidationResult valid', () => {
    const result: ValidationResult = {
      valid: true,
      version: { major: 1, minor: 0, patch: 0, _tag: 'Semver' } as any,
      sha: 'abc1234' as any,
      violations: [],
    }
    expect(result.valid).toBe(true)
    expect(result.violations).toHaveLength(0)
  })

  test('ValidationResult with violations', () => {
    const violation: MonotonicViolation = {
      existingVersion: { major: 0, minor: 9, patch: 0, _tag: 'Semver' } as any,
      existingSha: 'old1234' as any,
      relationship: 'ancestor',
      message: 'Non-monotonic',
    }
    const result: ValidationResult = {
      valid: false,
      version: { major: 1, minor: 0, patch: 0, _tag: 'Semver' } as any,
      sha: 'new5678' as any,
      violations: [violation],
    }
    expect(result.valid).toBe(false)
    expect(result.violations).toHaveLength(1)
  })

  test('AuditResult shape', () => {
    const audit: AuditResult = {
      packageName: '@kitz/core',
      valid: true,
      releases: [],
      violations: [],
    }
    expect(audit.packageName).toBe('@kitz/core')
    expect(audit.valid).toBe(true)
  })

  test('AuditViolation shape', () => {
    const v: AuditViolation = {
      earlier: { tag: '@kitz/core@1.0.0', version: {} as any, sha: 'a' as any },
      later: { tag: '@kitz/core@2.0.0', version: {} as any, sha: 'b' as any },
      message: 'Version ordering violation',
    }
    expect(v.earlier.tag).toBe('@kitz/core@1.0.0')
    expect(v.later.tag).toBe('@kitz/core@2.0.0')
  })
})
